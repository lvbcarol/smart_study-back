# 🧠 Smart Study - Backend

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

To run this server on your local machine, follow these steps:

1.  **Clone the repository:**
    ```bash
    git clone [https://github.com/seu-usuario/smart_study-back.git](https://github.com/seu-usuario/smart_study-back.git)
    cd smart_study-back
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Set up the Environment Variables:**
    * Create a `.env` file in the root of the project.
    * Add the following variables with your own secret keys:
        ```env
        MONGODB_URI=your_mongodb_atlas_connection_string
        JWT_SECRET=your_super_secret_jwt_key
        GEMINI_API_KEY=your_google_gemini_api_key
        PORT=3000
        ```
4.  **Start the development server:**
    ```bash
    npm run dev
    ```
    The API will be running at `http://localhost:3000`.

---

## 👩‍💻 Developed By

**Carolina Lansoni Vilas Boas**

In partnership with the **Instituto Mauá de Tecnologia** and the **Grand Challenges Scholarship Program**.
