# 🔐 Section 4: Access Control (ข้อกำหนดด้านสิทธิ์และการเข้าถึง)

---

title: 'Access Control'
version: 1.5.0
status: first-draft
owner: Nattanin Peancharoen
last_updated: 2025-11-30
related:

- specs/02-architecture/data-model.md#correspondence
- specs/03-implementation/backend-guidelines.md#correspondencemodule

---

## 4.1. Overview:

- Users and organizations can view and edit documents based on the permissions they have. The system's permissions will be based on Role-Based Access Control (RBAC).

## 4.2. Permission Hierarchy:

- Global: The highest level of permissions in the system
- Organization: Permissions within an organization, which is the basic permission for users
- Project: Permissions specific to a project, which will be considered when the user is in that project
- Contract: Permissions specific to a contract, which will be considered when the user is in that contract

## 4.3. Permission Enforcement:

- When checking permissions, the system will consider permissions from all levels that the user has and use the most permissive permission as the decision
- Example: User A is a Viewer in the organization, but is assigned as an Editor in Project X when in Project X, User A will have the right to edit

## 4.4. Role and Scope:

| Role                 | Scope        | Description                | Key Permissions                                                                                                       |
| :------------------- | :----------- | :------------------------- | :-------------------------------------------------------------------------------------------------------------------- |
| **Superadmin**       | Global       | System administrator       | Do everything in the system, manage organizations, manage global data                                                 |
| **Org Admin**        | Organization | Organization administrator | Manage users in the organization, manage roles/permissions within the organization, view organization reports         |
| **Document Control** | Organization | Document controller        | Add/edit/delete documents, set document permissions within the organization                                           |
| **Editor**           | Organization | Document editor            | Edit documents that have been assigned to them                                                                        |
| **Viewer**           | Organization | Document viewer            | View documents that have access permissions                                                                           |
| **Project Manager**  | Project      | Project manager            | Manage members in the project (add/delete/assign roles), create/manage contracts in the project, view project reports |
| **Contract Admin**   | Contract     | Contract administrator     | Manage users in the contract, manage roles/permissions within the contract, view contract reports                     |

## 4.5. Token Management (ปรับปรุง)

- **Payload Optimization:** ใน JWT Access Token ให้เก็บเฉพาะ `userId` และ `scope` ปัจจุบันเท่านั้น
- **Permission Caching:** สิทธิ์ละเอียด (Permissions List) ให้เก็บใน **Redis** และดึงมาตรวจสอบเมื่อ Request เข้ามา เพื่อลดขนาด Token และเพิ่มความเร็ว

## 4.6. Onboarding Workflow

- 4.6.1. Create Organization
  - **Superadmin** creates a new organization (e.g. Company A)
  - **Superadmin** appoints at least 1 user as **Org Admin** or **Document Control** of Company A
- 4.6.2. Add Users to Organization
  - **Org Admin** of Company A adds other users (Editor, Viewer) to the organization
- 4.6.3. Assign Users to Project
  - **Project Manager** of Project X (which may come from Company A or another company) invites or assigns users from different organizations to join Project X
  - In this step, **Project Manager** will assign **Project Role** (e.g. Project Member, or may use organization-level permissions)
- 4.6.4. Assign Users to Contract
  - **Contract Admin** of Contract Y (which is part of Project X) selects users from Project X and assigns them to Contract Y
  - In this step, **Contract Admin** will assign **Contract Role** (e.g. Contract Member) and specific permissions
- 4.6.5 Security Onboarding:
  - Force users to change password for the first time
  - Security awareness training for users with high permissions
  - Safe password reset process
  - Audit log recording every permission change

### **4.7. Master Data Management**

| Master Data                             | Manager                         | Scope                           |
| :-------------------------------------- | :------------------------------ | :------------------------------ |
| Document Type (Correspondence, RFA)     | **Superadmin**                  | Global                          |
| Document Status (Draft, Approved, etc.) | **Superadmin**                  | Global                          |
| Shop Drawing Category                   | **Project Manager**             | Project (สร้างใหม่ได้ภายในโครงการ) |
| Tags                                    | **Org Admin / Project Manager** | Organization / Project          |
| Custom Roles                            | **Superadmin / Org Admin**      | Global / Organization           |
| Document Numbering Formats              | **Superadmin / Admin**          | Global / Organization           |
