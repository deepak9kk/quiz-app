// src/app/app.component.ts
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { ChangeDetectorRef, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { PanelModule } from 'primeng/panel';
import { ProgressBarModule } from 'primeng/progressbar';
import { RadioButtonModule } from 'primeng/radiobutton';
import { TableModule } from 'primeng/table';

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
    teams: number,
    elimination: number[]
}

interface ScoreCard{
    team: string;
    previous: number;
    current: number;
    total: number;
    index: number;
}

interface Column {
    field: string;
    header: string;
}

interface SaveGame{
    usedQuestions: number[];
    currentRound: string;
    scores: number[];
    eliminatedTeams: number[];
    currentRoundScore: number[];
    currentRoundTeamDone: number[];
    eliminationRoundTeams: number[];
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
    ProgressBarModule,
    DialogModule,
    PanelModule
  ],
  providers: [ConfirmationService, MessageService]
})

export class AppComponent {
    questions: Question[] = [];
    config: Config = {} as Config;
    currentIndex = 0;
    selectedAnswer: string | null = null;
    scores: number[] = [];
    rounds = ["Mathematics", "Science", "English", "History", "Geography", "Computer Science", "General Knowledge", "Sports", "Biology", "Physics"];
    elimination = [5,4,3,2,1,1,1,1,1,1];
    usedQuestions: number[] = []; 
    currentRound: string = "Mathematics";
    currentTeam: number | null = null;
    eliminatedTeams: number[] = [];
    currentRoundScore: number[] = [];
    currentRoundTeamDone: number[] = [];
    gameStarted: boolean = false;
    currentQuestion!: Question;
    timeLapsed: number = 0;
    interval: any;
    stopTimerFlag: boolean = false;
    tempCorrectAnswer: boolean | undefined = undefined;
    failedToAnswer: boolean | undefined = undefined;
    eliminationRoundTeams: number[] = [];
    scoreCardVisible: boolean = false;
    scoreCard: ScoreCard[] = [];
    gameOver: boolean = false;
    cols: Column[] = [
        {field: 'team', header: 'Team'}, 
        {field: 'previous', header: 'Previous Score'}, 
        {field: 'current', header: 'Current Round Score'}, 
        {field: 'total', header: 'Total Score'}
    ]
    cols_final: Column[] = [
        {field: 'team', header: 'Team'}, 
        {field: 'total', header: 'Total Score'}
    ]
    audio = new Audio("assets/countdown.mp3");


    constructor(private http: HttpClient, private cs: ConfirmationService,private cdr: ChangeDetectorRef) {}

    ngOnInit() {
        this.http.get<Config>('assets/config.json').subscribe(data => {
            this.config = data;
            this.elimination = this.config.elimination;
            this.scores = Array(this.config.teams).fill(0);
            this.http.get<Question[]>('assets/questions.json').subscribe(data => {
                this.questions = data;
                const gameData = JSON.parse(localStorage.getItem("gameData") || '{}');
                if(gameData.usedQuestions) this.usedQuestions = gameData.usedQuestions;
                if(gameData.currentRound) this.currentRound = gameData.currentRound;
                if(gameData.scores) this.scores = gameData.scores;
                if(gameData.eliminatedTeams) this.eliminatedTeams = gameData.eliminatedTeams;
                if(gameData.currentRoundScore) this.currentRoundScore = gameData.currentRoundScore;
                if(gameData.currentRoundTeamDone) this.currentRoundTeamDone = gameData.currentRoundTeamDone;
                if(gameData.eliminationRoundTeams) this.eliminationRoundTeams = gameData.eliminationRoundTeams;
                this.cs.confirm({
                    key: "startGame",
                    accept: this.startGame,
                    reject: this.clearData,
                    acceptLabel: "Start/Restart",
                    rejectLabel: "Clear Data",
                    closable: false
                    })
            });
        });

        
    }

    startGame = () => {
        if(this.currentRoundTeamDone.length > 0){
            this.currentTeam = this.getTeam();
            if(this.currentTeam == null){
                this.roundOver();
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

    clearData = () => {
        localStorage.removeItem("gameData");
        window.location.reload();
    }

    startRound = () => {
        this.currentRoundScore = Array(this.config.teams).fill(0);
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

    showAnswer = () => {
        this.failedToAnswer = true;
    }

    markAnswer = (ans: string) => {
        this.stopTimerFlag = true;
        this.tempCorrectAnswer = ans === this.currentQuestion.answer;
    }

    startQuestion = () => {
        let round = this.currentRound;
        if(this.eliminationRoundTeams.length>0){
            round = "Elimination";
        }
        let availableQuestions = this.questions.filter(a => !this.usedQuestions.includes(a.id) && a.subject == round);
        this.currentQuestion = availableQuestions[Math.floor(Math.random() * availableQuestions.length)];
        this.gameStarted = true;
        this.timeLapsed = 0;
        this.stopTimerFlag = false;
        this.tempCorrectAnswer = undefined;
        this.failedToAnswer = undefined;

        //interval(1000).subscribe(() => {
        this.audio.currentTime = 0;
        this.audio.play();
        this.interval = setInterval(() => {
            //console.log(this.timeLapsed);
            if(this.stopTimerFlag){
                clearInterval(this.interval);
                this.audio.pause();
                this.audio.currentTime = 0;
            }
            else if(this.timeLapsed < 30){
                this.timeLapsed++;
            } else {
                clearInterval(this.interval);
                this.audio.pause();
                this.audio.currentTime = 0;
                this.cs.confirm({
                    key: 'timeup',
                    header: `Time-up`,
                    accept: this.showAnswer,
                    reject: () => {},
                    acceptLabel: "Show Answer",
                    rejectLabel: "Mark Answer"
                });
            }
            this.cdr.detectChanges();
        },1000);
            
        //})

    }

    
    getTeam = () => {
        let available = [];
        for (let i = 0; i < this.config.teams; i++) {
            if (!this.eliminatedTeams.includes(i) && !this.currentRoundTeamDone.includes(i)) {
              available.push(i);
            }
          }
        if (available.length === 0) return null;
        return available[Math.floor(Math.random() * available.length)];
    }

    roundOver = () => {
        this.showScoreCard();
        for(let i = 0; i<this.config.teams;i++){
            this.scores[i] = this.scores[i] + this.currentRoundScore[i];
        }
        this.currentRoundScore = [];
        this.currentRoundTeamDone = [];


        const idx = this.rounds.indexOf(this.currentRound);
        if(this.rounds.length > idx + 1)
        {
            let nextRoundTeamCount = this.elimination[idx+1];
            if(nextRoundTeamCount == this.elimination[idx]){
                this.nextRound(idx);
            }
            else{
                let sorted_list = this.scores
                    .map((value,index) => ({ value, index }))
                    .sort((a, b) => b.value - a.value);
                console.log(sorted_list);
                const eliminationScore = sorted_list[nextRoundTeamCount].value;

                let conflict_list = sorted_list.filter((value,index) => value.value == eliminationScore && index < nextRoundTeamCount)
                if(conflict_list.length == 0){
                    this.eliminatedTeams.push(...sorted_list.filter(a => a.value <= eliminationScore).map(a => a.index))
                    this.nextRound(idx);
                } else{
                    this.eliminationRoundTeams = [];
                    this.eliminationRoundTeams.push(...sorted_list.filter(a => !this.eliminatedTeams.includes(a.index) && a.value == eliminationScore).map(a => a.index));
                    this.eliminatedTeams.push(...sorted_list.filter(a => a.value < eliminationScore).map(a => a.index))
                    this.nextRound(idx);
                }

            }
        } else{
            this.scoreCard = [];
            for(let i=0; i<this.scores.length;i++){
                this.scoreCard.push({
                    team: `Team ${i+1}`,
                    previous: this.scores[i],
                    current: 0,
                    total: this.scores[i],
                    index: i
                })
            }
            this.scoreCard = this.scoreCard.sort((a,b) => b.total - a.total);
            this.gameOver = true;

        }

    }


    nextRound = (idx: number) => {
            this.currentRound = this.rounds[idx+1];
            this.cs.confirm({
            key: 'roundStart',
            header: `Round ${this.currentRound}`,
            acceptLabel: 'Start',
            accept: this.startRound,
            rejectVisible: false,
            closable: false
        });
    }
    


    submitAnswer() {
        if(this.tempCorrectAnswer == true){
        this.currentRoundScore[this.currentTeam!] = 10;
        }
        this.tempCorrectAnswer = undefined;
        this.failedToAnswer = undefined;
        this.selectedAnswer = null;
        
        this.timeLapsed = 0;
        this.currentRoundTeamDone.push(this.currentTeam!);
        this.gameStarted = false;
        //console.log(this.currentRoundTeamDone)
        //this.cdr.detectChanges();

        this.storeData();

        let nextTeam = this.getTeam()

        if(nextTeam != null){
            this.currentTeam = nextTeam;
            this.cs.confirm({
                key: 'start',
                header: `Next Question for Team ${this.currentTeam! + 1}`,
                acceptLabel: 'Start',
                accept: this.startQuestion,
                rejectVisible: false,
                closable: false
            })
        } else{
            this.roundOver();
        }
        
        


    }

    getRowStyle = (id: number) => {
        if(this.eliminatedTeams.includes(id)){
            return {'background-color': '#FF8C5B'}
        }
        if(this.eliminationRoundTeams.includes(id)){
            return {'background-color': '#FFDE59'}
        }
        return {}
    }

    showScoreCard = () => {
        this.scoreCard = [];
        for(let i=0; i<this.scores.length;i++){
            this.scoreCard.push({
                team: `Team ${i+1}`,
                previous: this.scores[i],
                current: this.currentRoundScore[i],
                total: this.scores[i] + this.currentRoundScore[i],
                index: i
            })
        }
        this.scoreCard = this.scoreCard.sort((a,b) => b.total - a.total);
        this.scoreCardVisible = true;
    }

    storeData = () => {
        let gameData =  {
            usedQuestions: this.usedQuestions,
            currentRound: this.currentRound,
            scores: this.scores,
            eliminatedTeams: this.eliminatedTeams,
            currentRoundScore: this.currentRoundScore,
            currentRoundTeamDone: this.currentRoundTeamDone,
            eliminationRoundTeams: this.eliminationRoundTeams
        } as SaveGame;

        localStorage.setItem("gameData", JSON.stringify(gameData));
    }

    
}
