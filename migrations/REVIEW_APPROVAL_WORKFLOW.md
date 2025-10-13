# Review Approval Workflow Implementation

**Date:** October 13, 2025  
**Migration:** `add_review_approval_workflow.sql`

## Overview

Implemented an admin approval workflow for user-submitted reviews. Previously, reviews went live immediately upon submission. Now, reviews must be approved by an admin before becoming visible to users.

## Workflow

### Previous Flow
```
User submits review → Review goes live immediately
```

### New Flow
```
User submits review → Review status: 'pending' → Admin reviews in admin portal → Admin approves/denies → If approved: status 'approved' (live), If denied: status 'denied' (archived with reason)
```

## Database Changes

### Tables Modified
- `brand_reviews`
- `supplier_reviews`
- `distributor_reviews`

### New Columns Added

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `status` | text | `'pending'` | Review approval status: `pending`, `approved`, or `denied` |
| `reviewed_at` | timestamptz | NULL | Timestamp when the review was approved or denied |
| `reviewed_by` | uuid | NULL | Admin user who approved or denied the review (references `auth.users.id`) |
| `review_notes` | text | NULL | Admin notes about approval/denial decision |

### Data Migration
- All existing reviews were updated to `status = 'approved'` to maintain current visibility

## API Routes

### Approve Review
**Endpoint:** `POST /api/reviews/[id]/approve`

**Request Body:**
```json
{
  "review_type": "brand | supplier | distributor",
  "review_notes": "Optional admin notes",
  "reviewed_by": "uuid (optional)"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Review approved successfully",
  "review": { /* updated review object */ }
}
```

### Deny Review
**Endpoint:** `POST /api/reviews/[id]/deny`

**Request Body:**
```json
{
  "review_type": "brand | supplier | distributor",
  "review_notes": "Required reason for denial",
  "reviewed_by": "uuid (optional)"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Review denied successfully",
  "review": { /* updated review object */ }
}
```

## Admin Interface Changes

### Reviews Page (`/reviews`)
- Added **Status filter** dropdown: All Status, Pending, Approved, Denied
- Added **Status column** with color-coded badges:
  - ⏳ Pending (yellow)
  - ✓ Approved (green)
  - ✕ Denied (red)
- **Actions column** now shows:
  - For pending reviews: "Approve" and "Deny" buttons
  - For denied reviews: Shows denial reason
  - All reviews: "Delete" button

### User Experience
- Admins can filter reviews by status to focus on pending approvals
- Approve action shows confirmation dialog
- Deny action prompts for required reason
- Review list refreshes automatically after approve/deny actions

## Status Values

- **`pending`**: Newly submitted review awaiting admin review
- **`approved`**: Review approved by admin and visible to all users
- **`denied`**: Review rejected by admin with reason stored in `review_notes`

## Best Practices

1. **Always provide a reason** when denying a review
2. **Review notes** can be used for internal documentation on approval decisions
3. **Default filter** in admin interface shows all reviews; use status filter to focus on pending
4. **Existing reviews** remain visible (migrated to 'approved' status)

## Future Enhancements

Potential improvements to consider:
- Email notifications to users when reviews are approved/denied
- Bulk approve/deny functionality
- Review moderation dashboard with statistics
- User appeal process for denied reviews
- Automated spam/profanity detection
- Review editing workflow (request changes before approval)
- Audit trail of who approved/denied what and when

