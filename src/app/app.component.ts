import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
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
import { TagModule } from 'primeng/tag';
interface Question {
  id: number;
  type: 'text' | 'image';
  subject: string;
  question: string;
  image?: string;
  options: string[];
  answer: string;
}

interface ScoreCard {
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

interface SaveGame {
  usedQuestions: number[];
  currentRoundIndex: number;
  scores: number[];
  eliminatedTeams: number[];
  round2QuestionCount?: number;
  currentRoundScore: number[];
  currentRoundTeamDoneCount: { [teamIndex: number]: number };
  teamPasses: { [teamIndex: number]: number };
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  standalone: true,
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
    PanelModule,
    TagModule
  ],
  providers: [ConfirmationService, MessageService]
})
export class AppComponent implements OnInit {
  // Quiz Configuration
  totalTeams = 4;
  questionsPerTeamPerRound = 2;

  rounds = [
    { name: "Slogans, Quotes & Wars", timerSec: 30, allowPass: true, eliminateCount: 1 },
    { name: "Bharat Ki Pehchan (Buzzer)", timerSec: 60, allowPass: false, eliminateCount: 1 },
    { name: "Tasveeron Mein Bharat", timerSec: 30, allowPass: true, eliminateCount: 0 }
  ];

  currentRoundIndex = 0;
  questions: Question[] = [];
  usedQuestions: number[] = [];
  scores: number[] = [];
  eliminatedTeams: number[] = [];
  buzzedTeam: number | null = null;
  currentRoundScore: number[] = [];
  currentRoundTeamDoneCount: { [teamIndex: number]: number } = {};
  teamPasses: { [teamIndex: number]: number } = {};
  round2QuestionCount = 0;
  currentTeam: number | null = null;
  currentQuestion!: Question;
  isPassedQuestion = false;
  passedFromTeam: number | null = null;

  // Template Binding Properties (Fixes TS2339 errors)
  selectedAnswer: string | null = null;
  tempCorrectAnswer: boolean | undefined = undefined;
  failedToAnswer: boolean | undefined = undefined;

  // Timer & Audio Properties
  timeLapsed = 0;
  interval: any;
  stopTimerFlag = false;
  
  gameStarted = false;
  scoreCardVisible = false;
  gameOver = false;
  scoreCard: ScoreCard[] = [];

  cols: Column[] = [
    { field: 'team', header: 'Team' },
    { field: 'previous', header: 'Previous Score' },
    { field: 'current', header: 'Current Round Score' },
    { field: 'total', header: 'Total Score' }
  ];

  cols_final: Column[] = [
    { field: 'team', header: 'Team' },
    { field: 'total', header: 'Total Score' }
  ];

  audio = new Audio("assets/countdown.mp3");

  constructor(
    private http: HttpClient,
    private cs: ConfirmationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.scores = Array(this.totalTeams).fill(0);
    this.currentRoundScore = Array(this.totalTeams).fill(0);
    this.resetTeamDoneCounts();

    this.http.get<Question[]>('assets/questions.json').subscribe(data => {
      this.questions = data;
      this.loadSavedState();

      this.cs.confirm({
        key: "startGame",
        header: "Quiz Setup",
        message: "Start or continue the session?",
        accept: this.startGame,
        reject: this.clearData,
        acceptLabel: "Start Game",
        rejectLabel: "Reset Data",
        closable: false
      });
    });
  }

  // Getters for Template
  get currentRound(): string {
    return this.rounds[this.currentRoundIndex]?.name || '';
  }

  get currentTimerLimit(): number {
    return this.rounds[this.currentRoundIndex]?.timerSec || 30;
  }

  resetTeamDoneCounts() {
    if (this.currentRoundIndex === 1) {
  this.round2QuestionCount = 0;
}
    for (let i = 0; i < this.totalTeams; i++) {
      this.currentRoundTeamDoneCount[i] = 0;
      this.teamPasses[i] = 0;
    }
  }

  startGame = () => {
    this.cs.confirm({
      key: 'roundStart',
      header: `Round ${this.currentRoundIndex + 1}: ${this.currentRound}`,
      acceptLabel: 'Begin Round',
      accept: this.startRound,
      rejectVisible: false,
      closable: false
    });
  };

  startRound = () => {
    this.currentRoundScore = Array(this.totalTeams).fill(0);
    this.promptNextTurn();
  };

  promptNextTurn() {
  if (this.currentRoundIndex === 1) {
    // Check if 15 total questions have been completed in Round 2
    if (this.round2QuestionCount >= 15) {
      this.roundOver();
      return;
    }

    this.cs.confirm({
      key: 'start',
      header: `Buzzer Round: Question ${this.round2QuestionCount + 1} of 15`,
      acceptLabel: 'Launch Question',
      accept: () => this.startQuestion(),
      rejectVisible: false,
      closable: false
    });
    return;
  }

  // --- Round 1 & Round 3 Team-based Logic ---
  this.currentTeam = this.getNextEligibleTeam();
  if (this.currentTeam === null) {
    this.roundOver();
    return;
  }

  this.cs.confirm({
    key: 'start',
    header: `Next Question for Team ${this.currentTeam + 1}`,
    acceptLabel: 'Start Question',
    accept: () => this.startQuestion(),
    rejectVisible: false,
    closable: false
  });
}

  handleBuzzerPress(teamIndex: number) {
    this.buzzedTeam = teamIndex;
    this.currentTeam = teamIndex; // Set active team to the buzzed team
  }

 startQuestion = (passed: boolean = false) => {
    this.buzzedTeam = null;
    this.isPassedQuestion = passed;
    this.selectedAnswer = null;
    this.tempCorrectAnswer = undefined;
    this.failedToAnswer = undefined;

    if (!passed) {
      // 1. Clean current round target subject name
      const targetSubject = this.currentRound.trim().toLowerCase();

      // 2. ONLY pick questions that strictly match this round's subject
      const available = this.questions.filter(
        q => !this.usedQuestions.includes(q.id) &&
             q.subject &&
             q.subject.trim().toLowerCase() === targetSubject
      );

      // If no questions match this subject strictly, alert the user with the EXACT missing subject name
      if (available.length === 0) {
        alert(`No remaining unused questions found with subject: "${this.currentRound}". Please ensure your questions.json has questions with this exact subject name!`);
        return;
      }

      // Pick a random question from ONLY this round's subject pool
      this.currentQuestion = available[Math.floor(Math.random() * available.length)];
    }

    this.gameStarted = true;
    this.timeLapsed = 0;
    this.stopTimerFlag = false;

    this.audio.currentTime = 0;
    this.audio.play();

    clearInterval(this.interval);
    this.interval = setInterval(() => {
      if (this.stopTimerFlag) {
        this.stopAudio();
      } else if (this.timeLapsed < this.currentTimerLimit) {
        this.timeLapsed++;
      } else {
        this.stopAudio();
        this.failedToAnswer = true;
        this.cs.confirm({
          key: 'timeup',
          header: `Time's Up!`,
          message: `Time limit reached. Correct answer is '${this.currentQuestion.answer}'`,
          acceptLabel: "Show Answer",
          rejectVisible: false,
          accept: () => {}
        });
      }
      this.cdr.detectChanges();
    }, 1000);
  };

  // Called when an option is selected in the UI
  markAnswer(ans: string) {
    this.stopAudio();
    this.tempCorrectAnswer = ans === this.currentQuestion.answer;
  }
  isOptionsDisabled(): boolean {
    // If answer feedback is showing, disable options
    if (this.tempCorrectAnswer !== undefined || this.failedToAnswer === true) {
      return true;
    }
    // In Round 2 (Buzzer Round), disable options until a team buzzes in
    if (this.currentRound === 'Round 2' && this.buzzedTeam === null) {
      return true;
    }
    return false;
  }

  // Called when clicking "Next" button in UI
  submitAnswer() {
  this.usedQuestions.push(this.currentQuestion.id);

  // Increment total counter if in Buzzer Round
  if (this.currentRoundIndex === 1) {
    this.round2QuestionCount++;
  }

  let points = 0;
  if (this.isPassedQuestion) {
    points = this.tempCorrectAnswer === true ? 1 : 0;
  } else {
    points = this.tempCorrectAnswer === true ? 2 : -1;
  }

  if (this.currentTeam !== null) {
    this.currentRoundScore[this.currentTeam] += points;
    if (!this.isPassedQuestion && this.currentRoundIndex !== 1) {
      this.currentRoundTeamDoneCount[this.currentTeam]++;
    }
  }

  this.tempCorrectAnswer = undefined;
  this.failedToAnswer = undefined;
  this.selectedAnswer = null;
  this.gameStarted = false;
  this.buzzedTeam = null;

  this.storeData();
  this.promptNextTurn();
}

  // Called when Pass button is clicked
  passQuestion() {
    if (!this.canPassQuestion()) return;

    this.stopAudio();
    if (this.currentTeam !== null) {
      this.teamPasses[this.currentTeam] = (this.teamPasses[this.currentTeam] || 0) + 1;
      this.passedFromTeam = this.currentTeam;
      
      // Pass to next active team
      let nextTeam = (this.currentTeam + 1) % this.totalTeams;
      while (this.eliminatedTeams.includes(nextTeam) || nextTeam === this.passedFromTeam) {
        nextTeam = (nextTeam + 1) % this.totalTeams;
      }

      this.currentTeam = nextTeam;
      this.cs.confirm({
        key: 'passConfirm',
        header: `Question Passed!`,
        message: `Question passed to Team ${this.currentTeam + 1}.`,
        acceptLabel: 'Start Passed Question',
        accept: () => this.startQuestion(true),
        rejectVisible: false
      });
    }
  }

  canPassQuestion(): boolean {
    const roundAllowsPass = this.rounds[this.currentRoundIndex]?.allowPass;
    const isNotAlreadyPassed = !this.isPassedQuestion;
    const currentTeamHasPassLeft = this.currentTeam !== null && (this.teamPasses[this.currentTeam] || 0) < 1;
    const isAnswerNotMarked = this.tempCorrectAnswer === undefined && this.failedToAnswer === undefined;

    return roundAllowsPass && isNotAlreadyPassed && currentTeamHasPassLeft && isAnswerNotMarked;
  }

  getNextEligibleTeam(): number | null {
    const eligibleTeams: number[] = [];
    for (let i = 0; i < this.totalTeams; i++) {
      if (
        !this.eliminatedTeams.includes(i) &&
        this.currentRoundTeamDoneCount[i] < this.questionsPerTeamPerRound
      ) {
        eligibleTeams.push(i);
      }
    }
    if (eligibleTeams.length === 0) return null;

    return eligibleTeams.sort(
      (a, b) => this.currentRoundTeamDoneCount[a] - this.currentRoundTeamDoneCount[b]
    )[0];
  }

  roundOver = () => {
    for (let i = 0; i < this.totalTeams; i++) {
      this.scores[i] += this.currentRoundScore[i];
    }

    this.showScoreCard();

    const currentEliminationCount = this.rounds[this.currentRoundIndex].eliminateCount;
    if (currentEliminationCount > 0) {
      const sortedActiveTeams = this.scores
        .map((value, index) => ({ value, index }))
        .filter(item => !this.eliminatedTeams.includes(item.index))
        .sort((a, b) => b.value - a.value);

      const newlyEliminated = sortedActiveTeams
        .slice(sortedActiveTeams.length - currentEliminationCount)
        .map(item => item.index);

      this.eliminatedTeams.push(...newlyEliminated);
    }

    if (this.currentRoundIndex < this.rounds.length - 1) {
      this.currentRoundIndex++;
      this.resetTeamDoneCounts();
      this.storeData();
    } else {
      this.gameOver = true;
    }
  };

  showScoreCard = () => {
    this.scoreCard = [];
    for (let i = 0; i < this.totalTeams; i++) {
      this.scoreCard.push({
        team: `Team ${i + 1}`,
        previous: this.scores[i] - this.currentRoundScore[i],
        current: this.currentRoundScore[i],
        total: this.scores[i],
        index: i
      });
    }
    this.scoreCard.sort((a, b) => b.total - a.total);
    this.scoreCardVisible = true;
  };

  stopAudio() {
    clearInterval(this.interval);
    this.audio.pause();
    this.audio.currentTime = 0;
    this.stopTimerFlag = true;
  }

  storeData = () => {
    
    const gameData: SaveGame = {
      usedQuestions: this.usedQuestions,
      currentRoundIndex: this.currentRoundIndex,
      scores: this.scores,
      eliminatedTeams: this.eliminatedTeams,
      currentRoundScore: this.currentRoundScore,
      currentRoundTeamDoneCount: this.currentRoundTeamDoneCount,
      teamPasses: this.teamPasses
    };
    localStorage.setItem("gameData", JSON.stringify(gameData));
    round2QuestionCount: this.round2QuestionCount;
  };

  loadSavedState = () => {
    const gameData = JSON.parse(localStorage.getItem("gameData") || '{}');
    if (gameData.round2QuestionCount !== undefined) {
  this.round2QuestionCount = gameData.round2QuestionCount;
}
    if (gameData.usedQuestions) this.usedQuestions = gameData.usedQuestions;
    if (gameData.currentRoundIndex !== undefined) this.currentRoundIndex = gameData.currentRoundIndex;
    if (gameData.scores) this.scores = gameData.scores;
    if (gameData.eliminatedTeams) this.eliminatedTeams = gameData.eliminatedTeams;
    if (gameData.currentRoundScore) this.currentRoundScore = gameData.currentRoundScore;
    if (gameData.currentRoundTeamDoneCount) this.currentRoundTeamDoneCount = gameData.currentRoundTeamDoneCount;
    if (gameData.teamPasses) this.teamPasses = gameData.teamPasses;
  };

  clearData = () => {
    localStorage.removeItem("gameData");
    window.location.reload();
  };

  getRowStyle = (id: number) => {
    if (this.eliminatedTeams.includes(id)) {
      return { 'background-color': '#FF8C5B' };
    }
    return {};
  };

  onScoreCardHide() {
    this.scoreCardVisible = false;
    
    // If the game is not over, auto-trigger the start of the next round
    if (!this.gameOver) {
      this.startGame();
    }
  }
}