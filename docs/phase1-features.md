# Klasly Phase 1 — Feature Guide

All new features shipped in Phase 1.

---

## Table of Contents

1. [Room Management](#1-room-management)
2. [Instructor Room Bookings](#2-instructor-room-bookings)
3. [Instructor Membership Tiers](#3-instructor-membership-tiers)
4. [Instructor Membership Billing](#4-instructor-membership-billing)
5. [Manager Permissions](#5-manager-permissions)

---

## 1. Room Management

**Target user**: Studio Owner

Manage physical spaces (rooms) within your studio. Rooms can be assigned to classes and booked by instructors.

### How to access
Sidebar → **Rooms**

### Features
- **Add a room**: Click "+ Add room" to register a new space (e.g., "Main Studio", "Practitioner Room")
- **Edit / delete rooms**: Modify existing room details
- **View bookings**: Click "View Bookings" to see all instructor room reservations
- **Assign to classes**: Associate a room with each class

### Screenshot
![Rooms management](images/rooms.png)

---

## 2. Instructor Room Bookings

**Target user**: Instructor

Instructors can self-schedule by booking studio rooms for their sessions directly from their portal.

### How to access
Instructor Portal → Sidebar → **Room Bookings**

### Features
- **Create a booking**: Click "+ Book a room" to reserve a room with date, start/end time, and session title
- **Public / private toggle**: Choose whether the booking is visible to members
- **Booking list**: View upcoming bookings as cards
- **Cancel a booking**: Cancel reservations you no longer need
- **Overlap detection**: Prevents double-booking the same room at the same time
- **Quota display**: If a membership tier is assigned, a progress bar shows monthly hours used vs. remaining

### Screenshot
![Instructor Room Bookings](images/instructor-room-bookings.png)

---

## 3. Instructor Membership Tiers

**Target user**: Studio Owner

Define membership tiers (plans) for instructors. Each tier sets a monthly hour limit and a price.

### How to access
Sidebar → **Settings** → **Instructor Membership Tiers** → "Manage Tiers"

### Features
- **Create a tier**: Click "+ Add tier" to define a new plan
  - Tier name (e.g., "Basic", "Pro", "Unlimited")
  - Monthly minutes (-1 for unlimited)
  - Monthly price (in cents)
- **Edit a tier**: Change name, time limit, or price
- **Activate / deactivate**: Toggle tier availability
- **Assign to instructors**: Select a tier from the instructor edit page

### Screenshot
![Instructor Membership Tiers](images/tiers.png)

### How quota enforcement works
1. Owner creates tiers (e.g., "Basic" = 20h/month, "Pro" = 40h/month)
2. Assign a tier to an instructor from their edit page
3. When the instructor books a room, the system calculates their used minutes for the current month
4. Bookings that exceed the limit are blocked with a clear error message
5. Instructors see a progress bar showing remaining hours on their Room Bookings page

---

## 4. Instructor Membership Billing

**Target user**: Instructor / Studio Owner

Charge instructors a monthly subscription fee for their membership tier via Stripe.

### How to access
Instructor Portal → Sidebar → **Membership**

### Features

#### Instructor side
- **View membership info**: See assigned tier name and monthly price
- **Start subscription**: Click "Start Subscription" to go through Stripe Checkout
- **Payment status badges**: Active / Not subscribed / Cancelling / Free
- **Manage subscription**: Access the Stripe Customer Portal to update payment method or cancel

#### Owner side
- **Instructor detail page**: "Membership Tier" card in the right sidebar showing:
  - Assigned tier name
  - Monthly price
  - Payment status badge (Free / Active / Not subscribed / Cancelling)

### Screenshot
![Instructor Membership](images/instructor-membership.png)

### Billing flow
1. Owner creates a tier and sets a monthly price
2. Owner assigns the tier to an instructor
3. Instructor visits the Membership page and clicks "Start Subscription"
4. Instructor enters payment details via Stripe Checkout
5. Webhook detects payment completion and activates the subscription
6. Monthly charges are automatically billed to the studio's Stripe Connect account

---

## 5. Manager Permissions

**Target user**: Studio Owner

Invite managers to help run your studio with customizable, granular permissions.

### How to access
Sidebar → **Managers**

### Features
- **Invite a manager**: Click "+ Invite manager" and enter an email address
  - Existing user: Role is automatically changed to manager
  - New user: Invitation email sent via Supabase Auth
- **Toggle permissions**: 7 permission flags, each independently on/off
- **Remove a manager**: Click "Remove" to revoke manager role (user becomes a member)

### Screenshot
![Managers page](images/managers.png)

### Permission flags

| Permission | Description | Default |
|---|---|---|
| **Members** | View, add, and edit members | ON |
| **Classes** | View, create, and edit classes | ON |
| **Instructors** | Manage instructors | OFF |
| **Bookings** | View and manage bookings | ON |
| **Rooms** | Manage rooms | ON |
| **Payments (view)** | View payment info (read-only) | ON |
| **Messages** | Send messages | ON |

### Owner vs. Manager comparison

| Feature | Owner | Manager |
|---|---|---|
| View dashboard | Yes | Yes |
| Manage members, classes, etc. | Yes | Depends on permissions |
| Stripe / payment settings | Yes | No |
| Studio settings | Yes | No |
| Invite / manage managers | Yes | No |
| Sidebar: Settings | Yes | No |
| Sidebar: Managers | Yes | No |

---

## Technical Reference

### New database tables
- `rooms` — Studio rooms / spaces
- `instructor_room_bookings` — Instructor room reservations
- `instructor_membership_tiers` — Membership tier definitions
- `instructor_memberships` — Instructor ↔ tier assignments + Stripe info
- `managers` — Manager permission records

### New API endpoints
- `GET/POST /api/rooms` — Room management
- `GET/POST/PATCH/DELETE /api/instructor/room-bookings` — Instructor room bookings
- `GET/POST/DELETE /api/instructor-memberships` — Membership management
- `GET/POST/PUT /api/instructor-membership-tiers` — Tier management
- `GET /api/instructor/quota` — Quota check
- `GET /api/instructor/membership` — Membership info
- `POST /api/stripe/instructor-membership-checkout` — Stripe Checkout session
- `GET/POST/PATCH/DELETE /api/managers` — Manager management

### Webhook handlers
Added to `/api/stripe/webhook` for instructor membership:
- `checkout.session.completed` → Save subscription ID
- `customer.subscription.updated` → Sync status
- `customer.subscription.deleted` → Remove subscription
