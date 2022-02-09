import { GrafanaTheme2, TimeRange } from '@grafana/data';
import { AxisPlacement, ScaleDirection, ScaleOrientation } from '@grafana/schema';
import { UPlotConfigBuilder } from '@grafana/ui';
import uPlot from 'uplot';
import { pointWithin, Quadtree, Rect } from '../barchart/quadtree';
import { HeatmapData } from './fields';

interface PathbuilderOpts {
  each: (u: uPlot, seriesIdx: number, dataIdx: number, lft: number, top: number, wid: number, hgt: number) => void;
  disp: {
    fill: {
      values: (u: uPlot, seriesIndex: number) => number[];
      index: Array<CanvasRenderingContext2D['fillStyle']>;
    };
  };
}

export interface HeatmapHoverEvent {
  xIndex: number;
  yIndex: number;
  pageX: number;
  pageY: number;
}

interface PrepConfigOpts {
  data: HeatmapData;
  theme: GrafanaTheme2;
  onhover: (evt?: HeatmapHoverEvent | null) => void;
  timeZone: string;
  timeRange: TimeRange; // should be getTimeRange() cause dynamic?
  palette: string[];
}

export function prepConfig(opts: PrepConfigOpts) {
  const { theme, onhover, timeZone, timeRange, palette } = opts;

  let qt: Quadtree;
  let hRect: Rect | null;

  let builder = new UPlotConfigBuilder(timeZone);

  let rect: DOMRect;

  builder.addHook('init', (u) => {
    u.root.querySelectorAll('.u-cursor-pt').forEach((el) => {
      Object.assign((el as HTMLElement).style, {
        borderRadius: '0',
        border: '1px solid white',
        background: 'transparent',
      });
    });
  });

  // rect of .u-over (grid area)
  builder.addHook('syncRect', (u, r) => {
    rect = r;
  });

  builder.addHook('setLegend', (u) => {
    if (u.cursor.idxs != null) {
      for (let i = 0; i < u.cursor.idxs.length; i++) {
        const sel = u.cursor.idxs[i];
        if (sel != null) {
          onhover({
            yIndex: i - 1,
            xIndex: sel,
            pageX: rect.left + u.cursor.left!,
            pageY: rect.top + u.cursor.top!,
          });
          return; // only show the first one
        }
      }
    }
    onhover(null);
  });

  builder.addHook('drawClear', (u) => {
    qt = qt || new Quadtree(0, 0, u.bbox.width, u.bbox.height);

    qt.clear();

    // force-clear the path cache to cause drawBars() to rebuild new quadtree
    u.series.forEach((s, i) => {
      if (i > 0) {
        // @ts-ignore
        s._paths = null;
      }
    });
  });

  builder.setMode(2);

  builder.addScale({
    scaleKey: 'x',
    isTime: true,
    orientation: ScaleOrientation.Horizontal,
    direction: ScaleDirection.Right,
    range: [timeRange.from.valueOf(), timeRange.to.valueOf()],
  });

  builder.addAxis({
    scaleKey: 'x',
    placement: AxisPlacement.Bottom,
    theme: theme,
  });

  builder.addScale({
    scaleKey: 'y',
    isTime: false,
    // distribution: ScaleDistribution.Ordinal, // does not work with facets/scatter yet
    orientation: ScaleOrientation.Vertical,
    direction: ScaleDirection.Up,
  });

  builder.addAxis({
    scaleKey: 'y',
    placement: AxisPlacement.Left,
    theme: theme,
  });

  builder.addSeries({
    facets: [
      {
        scale: 'x',
        auto: true,
        sorted: 1,
      },
      {
        scale: 'y',
        auto: true,
      },
    ],
    pathBuilder: heatmapPaths({
      each: (u, seriesIdx, dataIdx, x, y, xSize, ySize) => {
        qt.add({
          x: x - u.bbox.left,
          y: y - u.bbox.top,
          w: xSize,
          h: ySize,
          sidx: seriesIdx,
          didx: dataIdx,
        });
      },
      disp: {
        fill: {
          values: (u, seriesIdx) => countsToFills(u, seriesIdx, palette),
          index: palette,
        },
      },
    }) as any,
    theme,
    scaleKey: '', // facets' scales used (above)
  });

  builder.setCursor({
    dataIdx: (u, seriesIdx) => {
      if (seriesIdx === 1) {
        hRect = null;

        let cx = u.cursor.left! * devicePixelRatio;
        let cy = u.cursor.top! * devicePixelRatio;

        qt.get(cx, cy, 1, 1, (o) => {
          if (pointWithin(cx, cy, o.x, o.y, o.x + o.w, o.y + o.h)) {
            hRect = o;
          }
        });
      }

      return hRect && seriesIdx === hRect.sidx ? hRect.didx : null;
    },
    points: {
      fill: 'rgba(255,255,255, 0.3)',
      bbox: (u, seriesIdx) => {
        let isHovered = hRect && seriesIdx === hRect.sidx;

        return {
          left: isHovered ? hRect!.x / devicePixelRatio : -10,
          top: isHovered ? hRect!.y / devicePixelRatio : -10,
          width: isHovered ? hRect!.w / devicePixelRatio : 0,
          height: isHovered ? hRect!.h / devicePixelRatio : 0,
        };
      },
    },
  });

  return builder;
}

export function heatmapPaths(opts: PathbuilderOpts) {
  const { disp, each } = opts;

  return (u: uPlot, seriesIdx: number) => {
    uPlot.orient(
      u,
      seriesIdx,
      (
        series,
        dataX,
        dataY,
        scaleX,
        scaleY,
        valToPosX,
        valToPosY,
        xOff,
        yOff,
        xDim,
        yDim,
        moveTo,
        lineTo,
        rect,
        arc
      ) => {
        let d = u.data[seriesIdx];
        const xs = d[0] as unknown as number[];
        const ys = d[1] as unknown as number[];
        const counts = d[2] as unknown as number[];
        const dlen = xs.length;

        // fill colors are mapped from interpolating densities / counts along some gradient
        // (should be quantized to 64 colors/levels max. e.g. 16)
        let fills = disp.fill.values(u, seriesIdx);
        let fillPalette = disp.fill.index ?? [...new Set(fills)];

        let fillPaths = fillPalette.map((color) => new Path2D());

        // detect x and y bin qtys by detecting layout repetition in x & y data
        let yBinQty = dlen - ys.lastIndexOf(ys[0]);
        let xBinQty = dlen / yBinQty;
        let yBinIncr = ys[1] - ys[0];
        let xBinIncr = xs[yBinQty] - xs[0];

        // uniform tile sizes based on zoom level
        let xSize = Math.abs(valToPosX(xBinIncr, scaleX, xDim, xOff) - valToPosX(0, scaleX, xDim, xOff));
        let ySize = Math.abs(valToPosY(yBinIncr, scaleY, yDim, yOff) - valToPosY(0, scaleY, yDim, yOff));

        // bucket agg direction
        let xCeil = false;
        let yCeil = false;

        let xOffset = xCeil ? -xSize : 0;
        let yOffset = yCeil ? 0 : -ySize;

        // pre-compute x and y offsets
        let cys = ys.slice(0, yBinQty).map((y) => Math.round(valToPosY(y, scaleY, yDim, yOff) + yOffset));
        let cxs = Array.from({ length: xBinQty }, (v, i) =>
          Math.round(valToPosX(xs[i * yBinQty], scaleX, xDim, xOff) + xOffset)
        );

        for (let i = 0; i < dlen; i++) {
          // filter out 0 counts and out of view
          if (
            counts[i] > 0 &&
            xs[i] + xBinIncr >= scaleX.min! &&
            xs[i] - xBinIncr <= scaleX.max! &&
            ys[i] + yBinIncr >= scaleY.min! &&
            ys[i] - yBinIncr <= scaleY.max!
          ) {
            let cx = cxs[~~(i / yBinQty)];
            let cy = cys[i % yBinQty];

            let fillPath = fillPaths[fills[i]];

            rect(fillPath, cx, cy, xSize, ySize);

            each(u, 1, i, cx, cy, xSize, ySize);
          }
        }

        u.ctx.save();
        //	u.ctx.globalAlpha = 0.8;
        u.ctx.rect(u.bbox.left, u.bbox.top, u.bbox.width, u.bbox.height);
        u.ctx.clip();
        fillPaths.forEach((p, i) => {
          u.ctx.fillStyle = fillPalette[i];
          u.ctx.fill(p);
        });
        u.ctx.restore();

        return null;
      }
    );
  };
}

export const countsToFills = (u: uPlot, seriesIdx: number, palette: string[]) => {
  let counts = u.data[seriesIdx][2] as unknown as number[];
  let maxCount = counts.length > 65535 ? Math.max(...new Set(counts)) : Math.max(...counts);
  let cols = palette.length;

  let indexedFills = Array(counts.length);

  for (let i = 0; i < counts.length; i++) {
    indexedFills[i] = counts[i] === 0 ? -1 : Math.max(Math.round((counts[i] / maxCount) * cols) - 1, 0);
  }

  return indexedFills;
};
