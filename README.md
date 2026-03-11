# eSignatureGO

A pay-per-use electronic signature platform that eliminates subscription fees and complex pricing tiers.

## Overview

eSignatureGO provides professional e-signature capabilities with a simple credit system - users pay only for documents they send, making it ideal for small businesses, real estate professionals, and occasional users.

### Key Features

- **Pay-per-use model**: 1 credit = 1 document send (unlimited pages and recipients)
- **No subscriptions**: Credits never expire
- **PDF document preparation**: Upload PDFs, place signature/text/date/checkbox fields
- **Multi-recipient support**: Assign fields to specific recipients with signing order
- **Mobile-responsive signing**: Recipients sign via unique links, no account needed
- **Signature drawing**: Canvas-based signature pad with touch support
- **Credit system**: 2 free trial credits on signup, bulk pricing for purchases

## Tech Stack

### Backend
- Express.js 5.1 with TypeScript
- Prisma ORM with SQLite (dev) / PostgreSQL (production)
- JWT authentication
- Multer 2 for PDF uploads
- pdf-lib for PDF manipulation

### Frontend
- React 18 with TypeScript
- Vite build tool
- Tailwind CSS v4
- Zustand for state management
- React Router v6
- react-pdf for PDF viewing
- Lucide React for icons

## Getting Started

### Prerequisites
- Node.js 18+

### Installation

1. Clone the repository:
```bash
git clone https://github.com/zumu-g/esignature_GO.git
cd esignature_GO
```

2. Install dependencies:
```bash
cd backend && npm install
cd ../frontend && npm install
```

3. Setup environment variables:
```bash
cp backend/.env.example backend/.env
```

4. Setup database:
```bash
cd backend
npx prisma migrate dev
```

5. Start development servers:
```bash
# Terminal 1 - Backend (port 3001)
cd backend
npm run dev

# Terminal 2 - Frontend (port 5173)
cd frontend
npm run dev
```

6. Open http://localhost:5173 in your browser.

## Project Structure

```
esignatureGO/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma      # Database schema (7 models)
│   ├── src/
│   │   ├── index.ts            # Express server entry point
│   │   ├── middleware/
│   │   │   ├── auth.ts         # JWT authentication middleware
│   │   │   └── error.ts        # Error handling middleware
│   │   ├── routes/
│   │   │   ├── auth.ts         # Register, login, profile
│   │   │   ├── credits.ts      # Credit balance, purchase, history
│   │   │   ├── documents.ts    # Upload, list, send, download
│   │   │   ├── signatures.ts   # Signature CRUD
│   │   │   ├── signing.ts      # Public signing endpoints
│   │   │   └── health.ts       # Health check
│   │   ├── services/
│   │   │   └── pdf.service.ts  # PDF page counting and field embedding
│   │   └── types/
│   │       └── index.ts        # Shared TypeScript types
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.tsx             # Routing and auth guard
│   │   ├── main.tsx            # Entry point
│   │   ├── components/
│   │   │   └── Layout.tsx      # Nav bar with auth state
│   │   ├── lib/
│   │   │   └── api.ts          # API client and TypeScript types
│   │   ├── pages/
│   │   │   ├── Login.tsx       # Login form
│   │   │   ├── Register.tsx    # Registration form
│   │   │   ├── Dashboard.tsx   # Document list with upload
│   │   │   ├── DocumentPrepare.tsx  # PDF viewer + field placement + send
│   │   │   ├── SigningView.tsx      # Public signing experience
│   │   │   └── Credits.tsx          # Credit balance and purchase
│   │   └── store/
│   │       └── authStore.ts    # Zustand auth state
│   └── package.json
├── PRD.md                      # Product Requirements Document
├── DEVELOPMENT_PLAN.md         # Technical implementation plan
└── PHASE_2_ROADMAP.md          # Phase 2 features roadmap
```

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/auth/register | No | Create account |
| POST | /api/auth/login | No | Sign in |
| GET | /api/auth/me | Yes | Get current user |
| POST | /api/documents/upload | Yes | Upload PDF |
| GET | /api/documents | Yes | List documents |
| GET | /api/documents/:id | Yes | Get document details |
| GET | /api/documents/:id/pdf | Yes | Get PDF file |
| POST | /api/documents/:id/send | Yes | Send to recipients (costs 1 credit) |
| DELETE | /api/documents/:id | Yes | Delete document |
| GET | /api/documents/:id/download | Yes | Download signed PDF |
| GET | /api/sign/:link | No | Get signing document |
| GET | /api/sign/:link/pdf | No | Get PDF for signing |
| POST | /api/sign/:link/complete | No | Submit signed fields |
| GET | /api/signatures | Yes | List saved signatures |
| POST | /api/signatures | Yes | Create signature |
| DELETE | /api/signatures/:id | Yes | Delete signature |
| GET | /api/credits | Yes | Get balance and packs |
| POST | /api/credits/purchase | Yes | Buy credits (stubbed) |
| GET | /api/credits/history | Yes | Transaction history |

## Development Status

### Phase 1 MVP (In Progress)
- [x] User authentication (register/login/JWT)
- [x] PDF upload and storage
- [x] Document preparation (PDF viewer + field placement)
- [x] Multi-recipient management with signing order
- [x] Signing experience with signature pad
- [x] Credit system with purchase flow (Stripe stubbed)
- [x] UI polish pass (transitions, accessibility, loading states)
- [ ] End-to-end testing of full signing flow
- [ ] Template system
- [ ] Email notifications (currently manual link sharing)
- [ ] Stripe payment integration

### Phase 2 (Planned)
- Team management and shared documents
- Company branding (logo, colors)
- Advanced analytics and reporting
- SMS authentication

## Development Plan

See [DEVELOPMENT_PLAN.md](./DEVELOPMENT_PLAN.md) for detailed implementation timeline and technical specifications.

## License

MIT License - see [LICENSE](./LICENSE) file for details.
