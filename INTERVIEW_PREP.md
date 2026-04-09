# Interview Prep — folio-ai
> Living document. Add new questions as each concept is built and understood.
> Stack: Next.js App Router · Prisma 7 · PostgreSQL · NextAuth v5

---

## How to use this file
- Read the question first. Try to answer it out loud before reading the answer.
- The answer is what an interviewer expects — not a textbook definition.
- Add new questions at the bottom of each section as you learn.

---

## Schema Design

### Q1 — Why use `String @default(cuid())` for IDs instead of `Int @default(autoincrement())`?

**Short answer:** Sequential integers expose information and enable enumeration attacks. `cuid()` is collision-resistant, URL-safe, and reveals nothing about your data.

**Full answer:**
With `autoincrement()`, your user IDs are 1, 2, 3... A bad actor can guess that `/api/users/4` exists just because `/api/users/3` worked. This is called an **enumeration attack**.

`cuid()` generates IDs like `clh7x2k0f0000qw08...` — globally unique, unpredictable, and safe to expose in URLs. NextAuth also requires String IDs to link its tables (Account, Session) back to User.

**When would you still use `autoincrement()`?**
For internal join tables or rows that are never exposed in URLs — e.g., a logging or audit table where the ID is never surfaced to users.

---

### Q2 — What is `onDelete: Cascade` and when would you NOT use it?

**Short answer:** It automatically deletes child records when the parent is deleted. Without it, deleting a parent with children throws a foreign key constraint error.

**Full answer:**
In our schema, `Resume` relates to `User` with `onDelete: Cascade`. If a user deletes their account, their resume — and all experiences, skills, projects — are deleted automatically by the database. No extra application code needed.

**When NOT to use it:**
When you want to *preserve* the child data after the parent is gone. Example: if you had an `Order` model tied to a `User`, you might not cascade-delete orders when a user closes their account — you need them for financial records. In that case you'd use `onDelete: Restrict` (blocks deletion if children exist) or `onDelete: SetNull` (keeps the row, nulls the foreign key).

---

### Q3 — How do you enforce a 1-to-1 relationship in Prisma? What makes it different from 1-to-many?

**Short answer:** Add `@unique` to the foreign key field on the child model. Without `@unique`, Prisma creates a 1-to-many.

**Full answer:**
In our schema, `Resume` has `userId String @unique`. That `@unique` constraint means the database will reject a second resume row with the same `userId` — enforcing that one user can only have one resume.

Remove `@unique`, and it becomes 1-to-many — one user could have many resumes.

This distinction lives at the **database level**, not just the application level. Prisma generates the correct TypeScript types based on it too: with `@unique`, `user.resume` is `Resume | null`. Without it, `user.resumes` would be `Resume[]`.

---

### Q4 — What is the difference between a Primary Key, a Foreign Key, and a Unique Key?

**Short answer:** Primary key = row's unique identity within its table. Foreign key = a reference to a primary key in another table. Unique key = a field that can't repeat, but isn't the identity.

**Full answer:**

**Primary Key (`@id`)**
Uniquely identifies every row in a table. There can only be one per table. In our schema, every model has one:
```prisma
id  String  @id @default(cuid())
```
The database creates an index on it automatically — lookups by ID are fast.

**Foreign Key (`@relation`)**
A field in one table that references a primary key in another table. It is what creates the link between two tables. The database enforces that you cannot insert a foreign key value that doesn't exist in the referenced table — this is called **referential integrity**.
```prisma
model Resume {
  userId  String  @unique   // ← this is the foreign key
  user    User    @relation(fields: [userId], references: [id])
}
```
`userId` must match an existing `id` in the `User` table. If you try to create a Resume with a `userId` that doesn't exist, PostgreSQL rejects it.

**Unique Key (`@unique`)**
Prevents duplicate values in a column — but unlike a primary key, it is not the row's identity. A table can have many unique constraints.
```prisma
email  String  @unique   // two users cannot share an email
```

**How they work together in our schema:**
```
User.id (primary key)  ←──  Resume.userId (foreign key + unique key)
```
`Resume.userId` is a foreign key (links to User) AND has `@unique` on it (enforces the 1-to-1). Two separate responsibilities on one field.

---

### Q5 — What is a composite unique constraint? When do you use `@@unique` instead of `@unique`?

**Short answer:** `@unique` enforces uniqueness on one field. `@@unique` enforces uniqueness on a *combination* of fields — the combination must be unique, but each field individually can repeat.

**Full answer:**
Look at our `Account` model in the schema:
```prisma
model Account {
  provider          String
  providerAccountId String

  @@unique([provider, providerAccountId])
}
```
This says: the pair `(provider, providerAccountId)` must be unique — but `provider` alone can repeat (many users can use Google), and `providerAccountId` alone can repeat (the same person across different apps). Only the **combination** must be unique.

**Why this matters for NextAuth specifically:**
A user can sign in with Google (provider = "google", providerAccountId = "1234") and GitHub (provider = "github", providerAccountId = "5678"). Two Account rows, both pointing to the same User. Without this constraint, a bug could accidentally create two Google accounts for the same person — duplicating their identity.

**Interview test:** Would `@unique` on `providerAccountId` alone work here?
No — because two different users could have the same `providerAccountId` on different providers (e.g., Google and GitHub both assign ID "1234" to different people). You need both fields together.

---

## Authentication

### Q4 — What is the difference between Authentication and Authorization?

**Short answer:** Authentication = who are you? Authorization = what are you allowed to do?

**Full answer:**
- **Authentication** happens at login. You prove your identity (email + password, Google OAuth). The result is a session or token that says "this is Tarun."
- **Authorization** happens on every protected request. Given that we know it's Tarun, is Tarun allowed to do this specific thing?

**Real example from folio-ai:**
```
GET /api/resume          → Authentication: must be logged in
DELETE /api/admin/users  → Authorization: must be logged in AND have role ADMIN
```

A 401 means not authenticated (you haven't proven who you are).
A 403 means not authorized (we know who you are, but you don't have permission).

---

### Q5 — Why does NextAuth need its own database tables? What does each one do?

**Short answer:** NextAuth separates concerns — `User` is your domain, `Account` is the OAuth link, `Session` is the server-side session store, `VerificationToken` is for passwordless flows.

**Full answer:**

| Table | Purpose | Used when |
|---|---|---|
| `User` | Your user (identity + profile) | Always |
| `Account` | Links a User to an OAuth provider (Google, GitHub). Stores access/refresh tokens. One user can have multiple accounts. | OAuth login |
| `Session` | Stores active sessions server-side. Each row = one logged-in device. | Database session strategy only |
| `VerificationToken` | Stores one-time tokens for email magic links | Passwordless email login |

**The key insight:** `Account` is separate from `User` so one person can log in with Google AND GitHub and still map to the same `User` row. The `provider` + `providerAccountId` unique constraint prevents duplicate accounts from the same provider.

In our setup (Credentials + JWT sessions), `Session` and `VerificationToken` tables exist but stay empty. They cost nothing — and adding Google login later requires zero schema changes.

---

*Last updated: Level 1 — Schema Design + NextAuth setup*
