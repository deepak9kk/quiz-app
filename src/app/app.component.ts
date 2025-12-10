// src/app/app.component.ts
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { RadioButtonModule } from 'primeng/radiobutton';
import { TableModule } from 'primeng/table';

interface Question {
    id: number;
    type: 'text' | 'image';
    question: string;
    image?: string;
    options: string[];
    answer: string;
  }

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  imports: [
    ButtonModule,
    TableModule,
    CommonModule, 
    HttpClientModule, 
    RadioButtonModule, 
    CardModule,
    FormsModule
  ]
})

export class AppComponent {
    questions: Question[] = [];
    currentIndex = 0;
    selectedAnswer: string | null = null;
    score = 0;
    completed = false;

    constructor(private http: HttpClient) {}

    ngOnInit() {
        this.http.get<Question[]>('assets/questions.json').subscribe(data => {
            this.questions = data;
            console.log(this.questions);
        });
    }

    get currentQuestion() {
        return this.questions[this.currentIndex];
    }

    submitAnswer() {
        if (!this.selectedAnswer) return;

        if (this.selectedAnswer === this.currentQuestion.answer) {
            this.score++;
        }

        this.selectedAnswer = null;

        if (this.currentIndex < this.questions.length - 1) {
            this.currentIndex++;
        } else {
            this.completed = true;
        }
    }
}
