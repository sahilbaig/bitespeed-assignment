# Bitespeed-Assignment

This is a backend service to identify and consolidate user identities based on shared contact information (email and/or phone number). It groups related contacts, ensures a single primary contact per group, and links secondary contacts accordingly.

## Deployment

The API is deployed and accessible at:
<https://bitespeed-assignment-4a0l.onrender.com>

## API Endpoint

### POST `/identify`

Request body:

```json
{
  "email": "user@example.com",
  "phoneNumber": "1234567890"
}
```

Response:

If duplicate exists

```json
{
  "contact": {
    "primaryContactId": 1,
    "emails": ["user@example.com", "other@example.com"],
    "phoneNumbers": ["1234567890", "0987654321"],
    "secondaryContactIds": [2, 3]
  }
}
```

## Features

- Search contacts by email and/or phone number
- Group related contacts (primary + secondaries)
- Automatically promote the oldest contact as primary, demote others
- Insert new secondary contact if no exact match exists
- Returns unified contact info with primary ID, all emails, phone numbers, and secondary contact IDs

## Tech Stack

- Node.js + Express
- Supabase (PostgreSQL) for database
- TypeScript
