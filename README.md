# Aspira 🚀

Aspira is an AI-powered interview preparation platform designed to help candidates master their interview skills through realistic simulations, technical quizzes, and AI-driven feedback.

## ✨ Features

- **AI Interview Simulation**: Real-time voice and text interviews with industry-specific questions.
- **Skill Analytics**: Visual distribution of your performance across soft skills and technical knowledge.
- **AI Resume Studio**: Professional resume builder with AI-powered content generation.
- **Technical Quizzes**: Test your knowledge in various tech stacks (Frontend, Backend, DevOps, etc.).
- **Job Application Tracker**: Keep track of your job search progress in one place.
- **AI Career Coach**: Chat with an AI assistant for personalized career advice.

## 🛠️ Technology Stack

- **Frontend**: Vanilla HTML5, CSS3, JavaScript (Glassmorphism UI).
- **Backend**: Node.js, Express.js.
- **Database**: SQLite (built-in `node:sqlite`).
- **AI Integration**: Google Gemini API, Web Speech API.
- **Authentication**: Passport.js (Google, GitHub, Email/Password).

## 🚀 Getting Started

### Prerequisites

- Node.js (v22 or later recommended for `node:sqlite` support).
- A Google Gemini API Key.

### Installation

1. Clone the repository:
   ```bash
   git clone <your-repo-url>
   cd Aspira
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   - Copy `.env.example` to `.env`.
   - Add your `GOOGLE_AI_API_KEY`, `SESSION_SECRET`, and OAuth credentials.

4. Run the application:
   ```bash
   npm run dev
   ```
   The app will be available at `http://localhost:3000`.

## 📁 Project Structure

- `api/`: Backend routes and database logic.
- `public/`: Frontend assets (HTML, CSS, JS).
- `server.js`: Main entry point.

## 📄 License

This project is licensed under the MIT License.
