# SHIVAM DISTRIBUTOR (PVT) LTD - Business Management System

A comprehensive business management application built with React, TypeScript, and Supabase for SHIVAM DISTRIBUTOR (PVT) LTD.

## Features

- **Role-based Access Control**: Admin, Manager, Sales Rep, and Driver roles
- **Dashboard Analytics**: Real-time business insights and percentage calculators
- **Order Management**: Complete order processing with bill generation and downloads
- **Customer Management**: Customer data with filtering and search capabilities
- **Product Management**: Inventory tracking and stock management
- **Supplier Management**: Supplier relationships and purchase orders
- **Driver Interface**: Real-time delivery updates and order tracking
- **User Management**: Multi-role user administration
- **Bill Generation**: Automated invoice creation with company branding

## Tech Stack

- **Frontend**: React 19.1.1, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Real-time, Auth)
- **Build Tool**: Vite
- **Charts**: Recharts
- **Deployment**: Vercel

## Run Locally

**Prerequisites:** Node.js 16+

1. **Clone the repository:**
   ```bash
   git clone https://github.com/lithursan/webapp.git
   cd webapp
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   Create a `.env.local` file with your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Run the development server:**
   ```bash
   npm run dev
   ```

5. **Open in browser:**
   Navigate to `http://localhost:5173`

## Deploy to Vercel

1. **Install Vercel CLI globally:**
   ```bash
   npm install -g vercel
   ```

2. **Deploy to Vercel:**
   ```bash
   vercel
   ```

3. **Set environment variables in Vercel dashboard:**
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

## Project Structure

```
├── components/
│   ├── charts/          # Analytics charts
│   ├── layout/          # Header, Sidebar
│   ├── pages/           # Main application pages
│   └── ui/              # Reusable UI components
├── contexts/            # React contexts (Auth, Data, Theme)
├── utils/               # Utility functions
├── types.ts             # TypeScript type definitions
└── constants.tsx        # Application constants
```

## Default Users

The application comes with pre-configured user roles:
- **Admin**: Full system access
- **Manager**: Management features
- **Sales Rep**: Customer and order management
- **Driver**: Delivery interface

## Company Information

**SHIVAM DISTRIBUTOR (PVT) LTD**
- Business Registration: PV 00234567
- Contact: +94 123 456 789
- Email: info@shivamdistributor.lk
- Address: 123 Business District, Colombo 03, Sri Lanka 
