# Digital Logbook

A digital logbook application for students to create, fill, manage, and export academic/lab records — replacing traditional paper logbooks with a structured, template-driven digital workflow.

## Features

- **User Authentication** – Secure login system with JWT-based session handling
- **Custom Templates** – Design and manage logbook templates tailored to specific courses, labs, or activities
- **Fill Records** – Fill out logbook entries based on selected templates
- **My Records** – View, track, and manage all previously submitted logbook entries
- **PDF Export** – Generate and export completed logbook records as PDF documents
- **Protected Routes** – Role-based access ensures only authenticated users can access core features

## Tech Stack

### Frontend
- React 18
- Vite
- React Router DOM
- Axios (API communication)
- pdfjs-dist (PDF rendering/handling)

### Backend
- Node.js
- Express.js
- Multer (file uploads)
- UUID (unique record/session identifiers)
- JWT (authentication)

## Project Structure

```
logbook-app/
├── backend/                 # Express server, API routes, auth logic
└── frontend/
    ├── src/
    │   ├── api/              # Axios client & API configuration
    │   ├── components/       # Reusable UI components
    │   ├── context/          # Auth context (global user/session state)
    │   ├── pages/            # Login, Templates, TemplateDesigner, FillRecord, MyRecords
    │   ├── App.jsx           # Route definitions & protected routes
    │   └── main.jsx          # App entry point
    └── package.json
```

## Getting Started

### Prerequisites
- Node.js (v18 or higher recommended)
- npm

### Installation

Clone the repository:
```bash
git clone <your-repo-url>
cd digital-logbook/logbook-app
```

Install backend dependencies:
```bash
cd backend
npm install
```

Install frontend dependencies:
```bash
cd ../frontend
npm install
```

### Environment Variables

Copy the example environment file in the frontend and configure it:
```bash
cp .env.example .env
```

Set your API URL (adjust the port/host to match your backend):
```
VITE_API_URL=http://localhost:4000/api
```

> **Note:** If running in GitHub Codespaces, use the forwarded backend URL instead of `localhost`, and ensure the backend port is set to **Public** visibility in the Ports tab.

### Running the App

Start the backend server:
```bash
cd backend
npm run dev
```

In a separate terminal, start the frontend:
```bash
cd frontend
npm run dev
```

The frontend will be available at `http://localhost:5173` (or the port Vite assigns), and it will communicate with the backend via the configured `VITE_API_URL`.

## Usage

1. **Sign up / Log in** to access your account
2. **Create a Template** using the Template Designer to define the structure of your logbook entries
3. **Fill a Record** by selecting a template and entering your data
4. **View My Records** to see all past submissions
5. **Export to PDF** for submission or printing

## Contributing

Contributions are welcome. Please open an issue or submit a pull request with a clear description of your changes.

## License

This project is licensed under the MIT License.
