// src/pages/TermsOfUse.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const TermsOfUse: React.FC = () => {
  return (
    <div className="mx-auto max-w-3xl">
      <article className="rounded-2xl border border-border bg-card p-6 shadow-soft md:p-10">
        <h1 className="mb-2 text-4xl font-extrabold tracking-tight">Terms of Use</h1>
        <p className="mb-8 text-muted-foreground">Last Updated: 2026-03 (version 2026-03)</p>

          <div className="prose prose-themed max-w-none space-y-6">
            <p>Welcome to Smart Study! These Terms of Use ("Terms") govern your access to and use of our website, services, and applications (collectively, the "Service"). Please read these Terms carefully before using our Service.</p>
            <p>By accessing or using the Service, you agree to be bound by these Terms.</p>

            <h2 className="text-2xl font-bold pt-4 border-t mt-8">1. Introduction to Our Service</h2>
            <p>Smart Study is an AI-powered virtual study assistant designed to help students achieve their academic goals. Our Service allows you to create digital notebooks, generate summaries and quizzes from your study topics, and track your learning progress (the "Features").</p>

            <h2 className="text-2xl font-bold pt-4 border-t mt-8">2. User Accounts</h2>
            <p><strong>Eligibility:</strong> You must be at least 13 years old to create an account and use the Service.</p>
            <p><strong>Account Security:</strong> You are responsible for safeguarding your account password and for any activities or actions under your account. You agree to notify us immediately upon becoming aware of any breach of security or unauthorized use of your account.</p>
            <p><strong>Account Information:</strong> You agree to provide us with accurate, complete, and current registration information.</p>

            <h2 className="text-2xl font-bold pt-4 border-t mt-8">3. User-Generated Content</h2>
            <p><strong>Your Content:</strong> You retain full ownership of the content you create within the Service, including your notebook titles, lesson titles, and the topics you submit to our AI features ("User Content").</p>
            <p><strong>License to Us:</strong> By using the Service, you grant Smart Study a worldwide, non-exclusive, royalty-free license to use, reproduce, modify, and process your User Content solely for the purpose of operating and providing the Service to you.</p>

            <h2 className="text-2xl font-bold pt-4 border-t mt-8">4. Use of AI-Generated Content</h2>
            <p><strong>AI as a Tool:</strong> The summaries, quizzes, and feedback provided by our artificial intelligence features ("AI Content") are intended for study purposes only. They are generated based on the information you provide and public data.</p>
            <p><strong>Disclaimer:</strong> While we strive for accuracy, AI Content may contain errors or inaccuracies. It is not a substitute for professional academic or instructional advice. You are responsible for verifying the information against your course materials and other reliable sources. Smart Study is not liable for any academic or other consequences resulting from the use of AI Content.</p>

            <h2 className="text-2xl font-bold pt-4 border-t mt-8">5. Acceptable Use Policy</h2>
            <p>You agree not to misuse the Service or help anyone else to do so. You agree not to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Probe, scan, or test the vulnerability of any system or network.</li>
              <li>Breach or otherwise circumvent any security or authentication measures.</li>
              <li>Submit content that is unlawful, harmful, defamatory, obscene, or otherwise objectionable.</li>
              <li>Use the Service to infringe on the intellectual property rights of others.</li>
              <li>Use the Service to generate content for academic dishonesty (e.g., plagiarism).</li>
            </ul>

            <h2 className="text-2xl font-bold pt-4 border-t mt-8">6. Intellectual Property</h2>
            <p>All rights, title, and interest in and to the Service (excluding User Content), including its "look and feel," are and will remain the exclusive property of Carolina Lansoni Vilas Boas and her licensors. The Service is protected by copyright, trademark, and other laws of both Brazil and foreign countries.</p>

            <h2 className="text-2xl font-bold pt-4 border-t mt-8">7. Termination</h2>
            <p>We may terminate or suspend your access to the Service immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms. Upon termination, your right to use the Service will immediately cease.</p>

            <h2 className="text-2xl font-bold pt-4 border-t mt-8">8. Disclaimers and Limitation of Liability</h2>
            <p>The Service is provided on an "AS IS" and "AS AVAILABLE" basis. While we aim to provide a high-quality experience, we do not warrant that the service will be uninterrupted, secure, or error-free.</p>
            <p>In no event shall Smart Study, its creators, or its partners be liable for any indirect, incidental, special, consequential, or punitive damages arising out of or in connection with your use of the Service.</p>

            <h2 className="text-2xl font-bold pt-4 border-t mt-8">9. Privacy and Data Protection (LGPD)</h2>
            <p>Smart Study is an academic project and processes personal data in line with Brazil's General Data Protection Law (Lei n.º 13.709/2018, "LGPD"). This section explains what we collect, why, and the choices you have.</p>
            <p><strong>What we collect:</strong> your name, e-mail and (hashed) password; your preferences (language, theme, accessibility); the notebooks, lessons, chats, flashcards and agenda items you create; your quiz and task answers and scores; your study time; and a learning profile inferred from how you study (Kolb's experiential learning cycle).</p>
            <p><strong>Why we collect it:</strong> only to run the Service: to grade answers, build your study plan and dashboards, adapt quizzes to what you miss, and let teachers follow their classes. We do not sell your data and we do not use it for advertising.</p>
            <p><strong>What your teacher sees:</strong> if you join a class, your teacher sees your scores, task submissions and the class-level summaries. Your study time is shared with the teacher <em>only if you turn it on</em> (My account &gt; Privacy and data). You can also hide your learning profile; when hidden, it is not shown to you or to your teacher and is not used in your daily plan.</p>
            <p><strong>AI processing:</strong> topics, messages and support materials may be sent to a third-party AI provider (such as Google Gemini) to generate summaries, quizzes and feedback. Do not send sensitive personal information to the AI features. AI decisions are explained to you (for example, the "Why this?" on each study-plan item) and the grading of open answers can be reviewed by your teacher.</p>
            <p><strong>Your rights:</strong> you can download a copy of your data, correct it, and delete your account at any time in My account &gt; Privacy and data. Deleting your account erases your data from the Service. Teachers who delete their account also delete their classes, subjects, materials and tasks, and what students produced in them. You can withdraw consent at any time by deleting your account.</p>
            <p><strong>Consent and age:</strong> when you create an account we record that you accepted these Terms and the version you accepted. You must be at least 13 years old, and minors should have the consent of a parent or guardian, as required by the LGPD.</p>
            <p><strong>Contact for data requests:</strong> <a href="mailto:smartstudywebsite@gmail.com" className="text-primary hover:underline">smartstudywebsite@gmail.com</a>.</p>

            <h2 className="text-2xl font-bold pt-4 border-t mt-8">10. Governing Law</h2>
            <p>These Terms shall be governed and construed in accordance with the laws of Brazil, without regard to its conflict of law provisions.</p>

            <h2 className="text-2xl font-bold pt-4 border-t mt-8">11. Changes to Terms</h2>
            <p>We reserve the right, at our sole discretion, to modify or replace these Terms at any time. We will provide at least 30 days' notice prior to any new terms taking effect. By continuing to access or use our Service after those revisions become effective, you agree to be bound by the revised terms.</p>

            <h2 className="text-2xl font-bold pt-4 border-t mt-8">12. Contact Us</h2>
            <p>If you have any questions about these Terms, please contact us at: <a href="mailto:smartstudywebsite@gmail.com" className="text-primary hover:underline">smartstudywebsite@gmail.com</a>.</p>
          </div>

          <div className="mt-12 text-center">
            <Link to="/register" className="inline-flex items-center gap-2 font-medium text-primary hover:underline">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to Register
            </Link>
          </div>
      </article>
    </div>
  );
};

export default TermsOfUse;
