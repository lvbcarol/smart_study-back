import type pt from './pt';

// mesma estrutura do pt.ts (o TypeScript acusa se faltar alguma chave)
type Shape<T> = { [K in keyof T]: T[K] extends string ? string : Shape<T[K]> };

const en: Shape<typeof pt> = {
  common: { loading: 'Loading...', save: 'Save', cancel: 'Cancel', back: 'Back', retry: 'Try again', error: 'Something went wrong. Please try again.', create: 'Create' },
  auth: {
    tagline: 'Study calmly. Learn clearly.',
    loginTitle: 'Good to see you again', loginSubtitle: 'Log in to continue studying.',
    email: 'E-mail', emailPlaceholder: 'you@email.com', password: 'Password', passwordPlaceholder: 'Your password',
    signIn: 'Log in', signingIn: 'Signing in...', noAccount: "Don't have an account yet?", signUp: 'Sign up',
    registerTitle: 'Create your student account', registerSubtitle: 'It takes less than a minute. Teachers sign up on the website.',
    name: 'Full name', passwordHint: 'At least 6 characters.', createAccount: 'Create account', creating: 'Creating...',
    haveAccount: 'Already have an account?', logIn: 'Log in', invalid: 'Invalid e-mail or password.',
    registerError: 'Could not create the account. Please try again.', passwordShort: 'Password must be at least 6 characters long.',
    network: 'Could not reach the server. Check your connection and the API address.',
  },
  tabs: { home: 'Home', notebooks: 'Notebooks', tasks: 'Tasks', flashcards: 'Flashcards', profile: 'Profile' },
  home: {
    greeting: 'Hi, {{name}}!', title: 'What will we study today?',
    statNotebooks: 'Notebooks', statLessons: 'Lessons', statAverage: 'Quiz average', statTasks: 'Pending tasks', statCards: 'Cards to review',
    nextTask: 'Next task', reviewCards: 'Review flashcards', openNotebooks: 'Open my notebooks', quick: 'Shortcuts',
  },
  notebooks: {
    title: 'My notebooks', new: 'New notebook', newPlaceholder: 'E.g.: Object-Oriented Programming',
    lessons_one: '{{count}} lesson', lessons_other: '{{count}} lessons', noLessons: 'No lessons yet.', newLesson: 'New lesson', lessonPlaceholder: 'Lesson name',
    emptyTitle: 'No notebooks yet', emptyDesc: 'Create your first notebook to organize your lessons.', fromTeacher: 'From teacher', createError: 'Could not create.',
  },
  lesson: {
    summary: 'Summary and chat', summaryDesc: 'Ask for a summary and clear your doubts with the AI.', quiz: 'Quizzes', quizDesc: 'Test what you learned, with several question types.',
    flashcards: 'Generate flashcards', flashcardsDesc: 'Cards to review with spaced repetition.',
    materials_one: 'The AI is using {{count}} teacher material in this lesson.', materials_other: 'The AI is using {{count}} teacher materials in this lesson.',
  },
  summary: {
    initial: 'Hi, I am Bob, Smart Study\'s study assistant. Send me a topic and I will summarize it. After the summary, you can ask me questions about it.',
    placeholder: 'Type the subject...', followUp: 'Ask a question about the lesson...', send: 'Send', thinking: 'Thinking...',
    aiError: 'The AI service is busy right now. Wait a moment and try again.', save: 'Save conversation', saved: 'Conversation saved!', saveError: 'Could not save.',
  },
  quiz: {
    title: 'Quizzes', startNew: 'Start new quiz', attemptN: 'Attempt #{{n}}', noAttempts: 'No attempts yet. Start a new one!',
    topicTitle: 'What shall we test?', topicHint: 'The quiz has 8 questions of several types and adapts to what you miss the most.', topicPlaceholder: 'E.g.: Chain rule',
    start: 'Start', generating: 'Preparing the questions...', generateError: 'Could not generate the quiz. Please try again.',
    types: { multiple_choice: 'Multiple choice', fill_blank: 'Fill in the blank', open_text: 'Open answer', practical: 'Practical', real_case: 'Real case' },
    reinforcement: 'Reinforcement', reinforcing: 'I will reinforce, in a different way, what you missed before: {{topics}}.', usingMaterials_one: 'Using {{count}} teacher material.', usingMaterials_other: 'Using {{count}} teacher materials.',
    questionOf: 'Question {{current}} of {{total}}', answer: 'Answer', next: 'Next question', finish: 'Finish and submit', seeResult: 'See result',
    yourAnswer: 'Your answer', blankN: 'Blank {{n}}', writeHere: 'Write your answer here...', numericHint: 'You can type just the number (e.g. 3.5).',
    verdictCorrect: 'Correct!', verdictPartial: 'Partially correct ({{pct}}%)', verdictWrong: 'Incorrect', expected: 'Expected answer', explanation: 'Explanation', feedback: 'Comment',
    doneTitle: 'Quiz complete!', doneScore: 'You scored {{score}}% ({{correct}} of {{total}} correct).', backToLesson: 'Back to the lesson', reviewTitle: 'Attempt #{{n}} ({{score}}%)', noAnswer: '(no answer)',
    saveError: 'Could not submit. Please try again.', answerError: 'Could not grade your answer. Please try again.', loadError: 'Could not load.',
  },
  tasks: {
    title: 'Tasks', emptyTitle: 'No tasks here', emptyDesc: 'When a teacher publishes a task, it shows up here.',
    due: 'Due: {{date}}', noDue: 'No deadline', status: { pending: 'Pending', in_progress: 'In progress', submitted: 'Submitted' },
    overdue: 'Overdue', late: 'Submitted late', score: 'Score {{score}}%', start: 'Start task', resume: 'Continue task',
    instructions: 'Answers are only graded after you submit everything, and you can submit once. You can stop and continue later.',
    alreadySubmitted: 'You already submitted this task.', myAnswers: 'Your answers', sent: 'Task submitted! Your score: {{score}}%.', questions_one: '{{count}} question', questions_other: '{{count}} questions',
    resumeNote: 'You already answered {{count}} of {{total}} questions. Continue where you left off.', loadError: 'Could not load the tasks.',
  },
  flashcards: {
    title: 'Flashcards', subtitle: 'Swipe right if you remembered and left if you did not.', generate: 'Generate cards', generateTitle: 'Generate flashcards with AI',
    lesson: 'Lesson', topic: 'Topic', topicPlaceholder: 'E.g.: Chain rule', count: 'Number of cards', generating: 'Generating...',
    generated_one: '{{count}} new card added!', generated_other: '{{count}} new cards added!', noneNew: 'No new cards: these were already in the deck.',
    generateError: 'Could not generate the cards.', emptyTitle: 'No decks yet', emptyDesc: 'Generate cards from a lesson to start reviewing.',
    due: 'To review', new: 'New', learned: 'Well learned', study: 'Study', nothingDue: 'Nothing to review right now', noLessons: 'Create a lesson in a notebook to generate cards.',
    session: {
      progress: '{{done}} of {{total}} cards', flip: 'Show answer', flipHint: 'Tap the card to see the answer.', swipeHint: 'Swipe right if you remembered, left if you did not.',
      answer: 'Answer', remembered: 'Remembered', forgot: 'Forgot', retry: 'This card comes back at the end of the session.', box: 'Box {{box}}', newCard: 'New',
      doneTitle: 'Session complete!', doneRemembered: 'You got {{count}} cards right.', doneMissed_one: '{{count}} card needed reinforcement and will be back soon.',
      doneMissed_other: '{{count}} cards needed reinforcement and will be back soon.', doneClean: 'Nothing forgotten. Great!', studyMore: 'Study more', back: 'Back to decks',
      saveError: 'Could not save. Please try again.', nothingLeft: 'No more cards to review right now.',
    },
  },
  profile: {
    title: 'My profile', role: 'Student', appearance: 'Appearance', mode: 'Color mode', light: 'Light', dark: 'Dark', system: 'System', palette: 'Color palette',
    textSize: 'Text size', sizes: { small: 'Small', normal: 'Normal', large: 'Large' }, language: 'Language', logout: 'Log out', saveError: 'Could not save.',
  },
  teacher: { title: 'Teacher profile', text: 'The Smart Study app is for students. Classes, materials, tasks and results live on the website.', logout: 'Log out' },
};

export default en;
