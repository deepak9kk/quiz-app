// src/app/app.component.ts
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { ChangeDetectorRef, Component, NgZone } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ProgressBarModule } from 'primeng/progressbar';
import { RadioButtonModule } from 'primeng/radiobutton';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { interval } from 'rxjs';

interface Question {
    id: number;
    type: 'text' | 'image';
    subject: string;
    question: string;
    image?: string;
    options: string[];
    answer: string;
  }

interface Config{
    teams: number
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
    FormsModule,
    ConfirmDialogModule,
    ProgressBarModule
  ],
  providers: [ConfirmationService, MessageService]
})

export class AppComponent {
    questions: Question[] = [];
    config: Config = {} as Config;
    currentIndex = 0;
    selectedAnswer: string | null = null;
    score = 0;
    scores: number[] = [];
    completed = false;
    rounds = ["Mathematics", "Science", "English", "History", "Geography", "Computer Science", "General Knowledge", "Sports", "Biology", "Physics"];
    usedQuestions: number[] = []; 
    currentRound: string = "Mathematics";
    currentTeam: number | null = null;
    eliminatedTeams: number[] = [];
    currentRoundScore: number[] = [];
    currentRoundTeamDone: number[] = [];
    gameStarted: boolean = false;
    currentQuestion!: Question;
    timer: boolean = false;
    timeLapsed: number = 0;
    interval: any;


    constructor(private http: HttpClient, private cs: ConfirmationService,private cdr: ChangeDetectorRef) {}

    ngOnInit() {
        this.http.get<Config>('assets/config.json').subscribe(data => {
            this.config = data;
            this.scores = Array(this.config.teams).fill(0);
            this.http.get<Question[]>('assets/questions.json').subscribe(data => {
                this.questions = data;
                this.cs.confirm({
                    header: 'Are you sure?',
                    message: 'Please confirm to proceed.',
                    accept: this.startGame,
                    rejectVisible: false,
                    closable: false
                    })
            });
        });
    }

    startGame = () => {
        this.currentTeam = this.getTeam();
        if(this.currentTeam == null){
            const idx = this.rounds.indexOf(this.currentRound);
            if(this.rounds.length > idx + 1){
                this.currentRound = this.rounds[idx+1];
                this.currentRoundTeamDone = [];
            }
            else{
                console.log("Game Over");
            }
        }

        this.cs.confirm({
            key: 'roundStart',
            header: `Round ${this.currentRound}`,
            acceptLabel: 'Start',
            accept: this.startRound,
            rejectVisible: false,
            closable: false
        })
    }

    startRound = () => {
        this.currentTeam = this.getTeam();
        this.cs.confirm({
            key: 'start',
            header: `Next Question for Team ${this.currentTeam! + 1}`,
            acceptLabel: 'Start',
            accept: this.startQuestion,
            rejectVisible: false,
            closable: false
        })
    }

    startQuestion = () => {
        let availableQuestions = this.questions.filter(a => !this.usedQuestions.includes(a.id) && a.subject == this.currentRound);
        this.currentQuestion = availableQuestions[Math.floor(Math.random() * availableQuestions.length)];
        this.gameStarted = true;
        this.timeLapsed = 0;

        interval(1000).subscribe(() => {
            this.timeLapsed++;
            this.cdr.detectChanges();
        })

    }

    questionStart = () => {
        let availableQuestions = this.questions.filter(a => !this.usedQuestions.includes(a.id) && a.subject == this.currentRound);
        this.currentQuestion = availableQuestions[Math.floor(Math.random() * availableQuestions.length)];
        this.gameStarted = true;

    }

    getTeam = () => {
        let available = [];
        for (let i = 0; i <= this.config.teams; i++) {
            if (!this.eliminatedTeams.includes(i) && !this.currentRoundTeamDone.includes(i)) {
              available.push(i);
            }
          }
        if (available.length === 0) return null;
        return available[Math.floor(Math.random() * available.length)];
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
