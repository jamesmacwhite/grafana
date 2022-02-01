+++
title = "Add a user to an organization"
aliases = ["docs/sources/administration/manage-users-and-permissions/manage-server-users/add-user-to-org.md"]
weight = 30
+++

# Add a user to an organization

Add a user to an organization when you want the user to have access to organization resources such as dashboards, data sources, and playlists. A user must belong to one organization, but can also also belong to multiple organizations.

You are required to specify an Admin role for each organization. The first user you add to an organization becomes the Admin by default. After you assign the Admin role to a user, you can add other users to an organization as either Admins, Editors, or Viewers.

## Before you begin

- Add an organization
- [Add a user]({{< relref "./add-user.md">}})
- Ensure you have Grafana server administrator privileges

**To add a user to an organization**:

1. Sign in to Grafana as a server administrator.
1. Hover your cursor over the **Server Admin** (shield) icon until a menu appears, and click **Users**.
1. Click a user.
1. In the **Organizations** section, click **Add user to organization**.
1. Select an organization and a role.

   For more information about user permissions, refer to [Organization roles]({{< relref "../about-users-and-permissions/#organization-roles">}}).

1. Click **Add to organization**.

   <!--- Is the user made aware of this change, through email maybe? -->