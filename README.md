# Aspira 🚀

**Aspira** is an AI-powered interview preparation platform designed to help candidates master their interview skills through realistic simulations, technical quizzes, and AI-driven feedback. With a focus on modern design and seamless performance, it provides a comprehensive suite of tools for job seekers.

## ✨ Core Features

### 🎙️ AI Interview Simulator
- **Live Voice & Text Interaction**: Experience realistic interview scenarios powered by Google Gemini and Groq AI.
- **Dynamic Questioning**: Sector-specific questions (Software Engineering, Marketing, etc.) that adapt based on your experience level.
- **Detailed Feedback**: Instant analysis of your performance with actionable improvement tips.

### 📝 AI Resume Studio & ATS Checker
- **ATS Optimization**: Upload your resume to see how well it ranks against applicant tracking systems.
- **Resume Builder**: Professional templates with AI-powered content suggestions.
- **Keyword Extraction**: Identifies missing skills from job descriptions.

### 🧠 Skills & Knowledge Center
- **Technical Quizzes**: Interactive MCQ tests covering various tech stacks (Frontend, Backend, UI/UX, etc.).
- **Job Tracker**: A centralized kanban-style board to track all your applications from 'applied' to 'hired'.
- **Skill Distribution**: Visual analytics showing your profile strength and interview readiness.

### 👤 Advanced Profile Management
- **Avatar Customization**: Upload and manage profile pictures.
- **Completion Tracking**: A dynamic "Profile Strength" bar to help you build a complete professional identity.
- **Social Integration**: Link your GitHub, LinkedIn, and Portfolio directly to your profile.

---

## 🛠️ Technology Stack

### Frontend
- **Language**: Vanilla JavaScript (ES6+), HTML5, CSS3.
- **Design**: Premium "Glassmorphism" UI with dark mode, smooth transitions, and responsive layouts.
- **Icons**: Lucide React / Lucide HTML (via CDN).
- **Libraries**: `pdf.js` (for resume parsing), generic Charting for analytics.

### Backend
- **Framework**: Node.js with Express.js.
- **Database**: SQLite (using the built-in `node:sqlite` module for Node.js 22+).
- **Authentication**: Passport.js with Local, Google OAuth 2.0, and GitHub OAuth strategies.
- **Storage**: `multer` for handling profile picture uploads.

### AI Engine
- **Primary AI**: Google Gemini Pro API.
- **Backup/Secondary**: Groq SDK for high-speed inference.
- **Voice**: Web Speech API (Synthesis & Recognition).

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v22 or later (required for the built-in `node:sqlite` features).
- **API Keys**:
    - [Google AI API Key](https://aistudio.google.com/) (Gemini).
    - [Groq API Key](https://console.groq.com/) (Optional/Secondary).
    - Google/GitHub OAuth Credentials (for social login).

### Installation

1. **Clone the repository:**
   ```bash
   git clone <your-repo-url>
   cd Aspira
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment:**
   Create a `.env` file in the root directory:
   ```env
   PORT=3000
   SESSION_SECRET=your_long_random_secret_here
   GOOGLE_AI_API_KEY=your_gemini_key
   GROQ_API_KEY=your_groq_key
   
   # Social Auth
   GOOGLE_CLIENT_ID=your_id
   GOOGLE_CLIENT_SECRET=your_secret
   GITHUB_CLIENT_ID=your_id
   GITHUB_CLIENT_SECRET=your_secret
   ```

4. **Run the server:**
   ```bash
   npm run dev
   ```
   Visit `http://localhost:3000` to start your journey.

---

## 📁 Project Structure

```text
├── backend/
│   ├── api/             # API Routes (auth, resumes, interviews, etc.)
│   │   └── db.js         # SQLite Database initialization and schema
│   ├── server.js        # Express server and middleware setup
│   └── uploads/         # Store for user avatars
├── frontend/
│   ├── css/             # Global and component-specific styles
│   ├── js/              # Shared logic and page-specific scripts
│   ├── assets/          # Images and static assets
│   └── *.html           # Application pages
└── package.json         # Scripts and dependencies
```

## 📄 License
This project is licensed under the MIT License.
