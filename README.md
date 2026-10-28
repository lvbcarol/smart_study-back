# 🧠 Smart Study

## 🚀 About the Project

This repository contains the **backend server** for the Smart Study application. It is a robust and secure **Node.js API** built with **Express and TypeScript**, designed to power all the features of the AI-powered study assistant.

The backend is responsible for user authentication, data management with MongoDB, and, most importantly, integrating with the **Google Gemini AI** to provide intelligent summaries and quizzes.

---

## ✨ Core Functionalities

* **🔐 Secure Authentication:**
    * User registration with password hashing using `bcrypt.js`.
    * Login system with **JSON Web Tokens (JWT)** for secure, stateless authentication.
    * Protected routes using custom authentication middleware.
* **📚 Full CRUD API for Notebooks:**
    * Endpoints to Create, Read, Update, and Delete notebooks and lessons.
    * Securely associates all content with the logged-in user.
* **🧠 AI Integration with Google Gemini:**
    * **Summarizer Endpoint:** Receives a topic and a language, and uses a detailed prompt to instruct the Gemini API to generate a high-quality, formatted summary with sources.
    * **Quiz Generator Endpoint:** Instructs the Gemini API to generate a complete 8-question quiz and return it in a structured **JSON format**, ensuring reliability.
* **📈 Data Processing for Progress Tracking:**
    * An endpoint dedicated to fetching and processing all of a user's quiz attempts to provide structured data ready for visualization in the frontend charts.
* **⚙️ User Preferences Management:**
    * Endpoints to save and retrieve user settings, such as preferred language and accessibility options.

---

## 🛠️ Tech Stack

The backend is built with a focus on performance, security, and scalability:

* **Runtime:** [Node.js](https://nodejs.org/)
* **Framework:** [Express.js](https://expressjs.com/)
* **Language:** [TypeScript](https://www.typescriptlang.org/)
* **Database:** [MongoDB](https://www.mongodb.com/) with [Mongoose](https://mongoosejs.com/) for data modeling.
* **Authentication:** [JSON Web Token (JWT)](https://jwt.io/) & [bcrypt.js](https://github.com/kelektiv/bcrypt.js)
* **AI Integration:** [Google Gemini API](https://ai.google.dev/) (`@google/generative-ai`)
* **Environment Management:** [dotenv](https://github.com/motdotla/dotenv)
* **CORS Handling:** [cors](https://github.com/expressjs/cors)

---

## ⚙️ Running Locally

Monorepo: `backend/` (Express + MongoDB) and `frontend/` (Vite + React).

1.  **Install everything:**
    ```bash
    npm run install:all
    ```
2.  **Environment variables:** copy the examples and edit as needed.
    ```bash
    cp backend/.env.example backend/.env
    cp frontend/.env.example frontend/.env
    ```
    * `MONGO_URI=memory` starts an in-memory MongoDB (data is lost on restart). For persistence, use a MongoDB Atlas connection string.
    * `AI_MODE=mock` returns fake summaries/quizzes (no key needed). Use `AI_MODE=gemini` with `GEMINI_API_KEY` (and optionally `GEMINI_MODEL`) for the real AI.
3.  **Start both apps:**
    ```bash
    npm run dev
    ```
    API: `http://localhost:3000/api` (health check: `/api/health`) · Frontend: `http://localhost:5173`.

---

## 📱 Mobile app (Expo)

The `mobile/` folder is a React Native app (Expo SDK 58 + Expo Router) for **students**: sign in, notebooks, summary chat, quizzes (all question types, with adaptive reinforcement), tasks, flashcards with swipe, and a profile with theme and palette. Teachers use the website.

```bash
npm run install:mobile      # once
npm run dev                 # backend + website (in another terminal)
npm run dev:mobile          # Expo: scan the QR code with Expo Go on your phone
npm run dev:mobile:web      # or test in the browser
```

* The phone and the computer must be on the **same Wi-Fi**. The app finds the backend through the computer's IP (port 3000); on Windows, allow Node.js through the firewall when asked.
* To point to another backend, set `EXPO_PUBLIC_API_URL` (see `mobile/.env.example`).
* Palettes are shared with the website: if you edit `frontend/src/theme/palettes.ts`, copy it to `mobile/src/theme/palettes.ts` and run `npm --prefix mobile run check:palettes`.

---

## 👩‍💻 Developed By

**Carolina Lansoni Vilas Boas**

In partnership with the **Instituto Mauá de Tecnologia** and the **Grand Challenges Scholarship Program**.
