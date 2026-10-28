// src/models/FlashcardDeck.ts — baralho de flashcards de um aluno para uma aula (com o progresso de cada cartão)
import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export interface IFlashcard {
  _id: Types.ObjectId;
  front: string;
  back: string;
  topic: string;
  // repetição espaçada (ver flashcards/leitner.ts)
  box: number;
  dueAt: Date;
  lapses: number;
  reps: number;
  lastAt?: Date;
}

export interface IFlashcardDeck extends Document {
  user: Types.ObjectId;
  notebook: Types.ObjectId;
  lesson: Types.ObjectId;
  title: string;
  cards: IFlashcard[];
  createdAt: Date;
}

const FlashcardSchema = new Schema<IFlashcard>({
  front: { type: String, required: true, maxlength: 400 },
  back: { type: String, required: true, maxlength: 1000 },
  topic: { type: String, default: '', maxlength: 80 },
  box: { type: Number, default: 0, min: 0, max: 5 },
  dueAt: { type: Date, default: Date.now },
  lapses: { type: Number, default: 0 },
  reps: { type: Number, default: 0 },
  lastAt: { type: Date },
});

const FlashcardDeckSchema: Schema = new Schema<IFlashcardDeck>({
  user: { type: Schema.Types.ObjectId, ref: 'Usuario', required: true },
  notebook: { type: Schema.Types.ObjectId, ref: 'Notebook', required: true },
  lesson: { type: Schema.Types.ObjectId, required: true },
  title: { type: String, required: true, maxlength: 200 },
  cards: [FlashcardSchema],
}, { timestamps: true });

// um baralho por aluno e aula (novos cartões são acrescentados a ele)
FlashcardDeckSchema.index({ user: 1, lesson: 1 }, { unique: true });

const FlashcardDeck: Model<IFlashcardDeck> = mongoose.models.FlashcardDeck || mongoose.model<IFlashcardDeck>('FlashcardDeck', FlashcardDeckSchema);

export default FlashcardDeck;
