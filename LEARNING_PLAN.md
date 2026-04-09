# Folio AI — Learning Plan
> Turn your resume into a stunning portfolio — powered by AI
> Stack: Next.js App Router · Prisma 7 · PostgreSQL · NextAuth · MCP Server · Vercel

---

## Current Status

| Area | Status |
|---|---|
| PostgreSQL setup (Docker) | ✅ Done |
| Prisma 7 config (`prisma.config.ts`) | ✅ Done |
| Generated client (`src/generated/prisma`) | ✅ Done |
| `lib/db.ts` singleton with `PrismaPg` adapter | ✅ Done |
| User schema (`passwordHash`, `role` enum, `Booking[]`) | ✅ Done |
| Register + Login API | 🔄 In Progress |
| JWT auth + middleware | ⬜ Next |

---

## Level 1 — Fundamentals

> Goal: Solid auth foundation. Every Level 2 feature depends on knowing *who* made the request.

### Steps (in order)

| # | Task | Key Concept |
|---|---|---|
| 1 | Fix Register API — hash password, save to DB | `bcrypt.hash()`, never store plain passwords |
| 2 | Fix Login API — verify password, return JWT | `bcrypt.compare()`, stateless auth |
| 3 | Add `lib/auth.ts` — JWT sign + verify helpers | JWT anatomy (header · payload · signature) |
| 4 | Add auth middleware — extract + validate token | Request lifecycle, 401 vs 403 |
| 5 | Build `GET /api/me` (protected route) | Token → user identity |
| 6 | Store JWT in `httpOnly` cookie | Why not `localStorage` (XSS risk) |

### Concepts to be able to explain

- What is the difference between **authentication** and **authorization**?
- Why do we **hash** passwords and not **encrypt** them?
- What is a **JWT**? What are its 3 parts? Where should it be stored?
- What happens on every HTTP request? (request → middleware → handler → response)
- What HTTP status codes mean: `200`, `201`, `400`, `401`, `403`, `404`, `500`

### Schema at end of Level 1

```prisma
model User {
  id           Int       @id @default(autoincrement())
  email        String    @unique
  name         String
  passwordHash String
  role         Role      @default(CUSTOMER)
  createdAt    DateTime  @default(now())
  bookings     Booking[]
}

enum Role {
  CUSTOMER
  BUSINESS_OWNER
}
```

---

## Level 2 — Product Thinking

> Goal: Real features built on top of working auth. Build in order — each step depends on the previous.

### Steps (in order)

| # | Task | Key Concept |
|---|---|---|
| 1 | `Service` model + CRUD API | 1-to-many relations, `Decimal` for money |
| 2 | `Booking` model + create booking | Foreign keys, relational schema design |
| 3 | Double-booking prevention | DB constraints vs app-level checks, race conditions |
| 4 | Booking status machine | Enum state machines (`PENDING → CONFIRMED → COMPLETED`) |
| 5 | Role-based route guards | Authorization middleware, `CUSTOMER` vs `BUSINESS_OWNER` |
| 6 | Business owner dashboard | Filtered queries, `prisma.booking.findMany({ where: {} })` |

### Schema at end of Level 2

```prisma
model Service {
  id          Int       @id @default(autoincrement())
  name        String
  price       Decimal
  durationMin Int
  bookings    Booking[]
}

model Booking {
  id        String        @id @default(cuid())
  userId    Int
  serviceId Int
  status    BookingStatus @default(PENDING)
  startTime DateTime
  endTime   DateTime
  user      User          @relation(fields: [userId], references: [id])
  service   Service       @relation(fields: [serviceId], references: [id])
}

enum BookingStatus {
  PENDING
  CONFIRMED
  COMPLETED
  CANCELLED
}
```

### Concepts to be able to explain

- What is a **foreign key**? What does `@relation` do in Prisma?
- Why use `cuid()` for Booking IDs but `autoincrement()` for internal IDs?
- What is a **race condition**? How do you prevent double bookings?
- What is the difference between **authentication** middleware and **authorization** middleware?
- What is an **enum state machine**? Why model booking status as one?

---

## Level 3 — Interview Level

> Goal: Depth of understanding. These are what separate junior from mid/senior in interviews.

| Topic | What interviewers ask |
|---|---|
| **Pagination** | Cursor vs offset — why is cursor better at scale? |
| **Transactions** | What is ACID? When do you need `prisma.$transaction()`? |
| **N+1 Problem** | What is it? How does Prisma's `include` solve it? |
| **Optimistic UI** | What does it mean? When does it fail? How do you roll back? |
| **Error boundaries** | Where do you catch errors — DB layer, service layer, route layer? |
| **Clean architecture** | Why separate routes / services / repositories? |
| **Audit logs** | How do you track who changed what and when? |

---

## Project Structure (Target)

```
car-wash-genie/
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── register/route.ts
│   │   │   └── login/route.ts
│   │   ├── bookings/
│   │   │   ├── route.ts            ← GET all, POST create
│   │   │   └── [id]/route.ts       ← GET one, PATCH status
│   │   └── services/
│   │       └── route.ts
│   ├── (pages)/
│   │   ├── register/page.tsx
│   │   ├── login/page.tsx
│   │   └── dashboard/page.tsx
│   └── lib/
│       ├── db.ts                   ← Prisma singleton ✅
│       ├── auth.ts                 ← JWT sign/verify helpers
│       └── middleware.ts           ← Route protection helper
├── src/
│   └── generated/
│       └── prisma/                 ← Generated client ✅
├── prisma/
│   ├── schema.prisma               ✅
│   └── migrations/
├── prisma.config.ts                ✅
└── .env
```

---

## Common Mistakes to Avoid

| Mistake | Why it's wrong |
|---|---|
| Storing JWT in `localStorage` | Vulnerable to XSS — use `httpOnly` cookies |
| Running Prisma queries in React components | Always go through API routes — never expose DB to client |
| Calling `new PrismaClient()` everywhere | Creates a new connection pool each time — use the singleton |
| Using `String` for roles | Use an `enum` — prevents invalid values at the DB level |
| No try/catch in API routes | Unhandled errors expose stack traces and crash routes |
| Forgetting `await` on Prisma calls | Prisma returns Promises — silent bugs without `await` |
| App-only double booking check | DB-level constraint or transaction lock — app checks can race |
| Mixing `prisma-client-js` + `prisma-client` providers | Prisma 7 uses `prisma-client` only |

---

## Immediate Next Steps

```
1. ⬜  Register API   → bcrypt.hash() → save user → return 201
2. ⬜  Login API      → bcrypt.compare() → sign JWT → set httpOnly cookie
3. ⬜  lib/auth.ts    → signToken() + verifyToken() helpers
4. ⬜  middleware.ts  → protect routes, attach user to request
5. ⬜  GET /api/me    → first protected route test
6. ⬜  Run migration  → npx prisma migrate dev --name add_booking_relation
```
