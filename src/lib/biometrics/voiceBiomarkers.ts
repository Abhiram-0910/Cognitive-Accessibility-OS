export class VoiceBiomarkerEngine {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private recognition: any = null; // any used for webkitSpeechRecognition
  private isRunning = false;
  private wordCount = 0;
  private startTime = 0;

  async startAnalysis(onTick: (metrics: { speechRate: number, vocalEnergy: number }) => void) {
    this.isRunning = true;
    this.startTime = Date.now();
    this.wordCount = 0;

    try {
      // 1. Acoustic Energy setup (Web Audio API)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      source.connect(this.analyser);

      const dataArray = new Uint8Array(this.analyser.frequencyBinCount);

      // 2. Temporal/Speech setup (Web Speech API)
      const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;

        this.recognition.onresult = (event: any) => {
          let interimWords = 0;
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              this.wordCount += transcript.split(/\s+/).filter(Boolean).length;
            } else {
              interimWords += transcript.split(/\s+/).filter(Boolean).length;
            }
          }
          
          const elapsedMinutes = (Date.now() - this.startTime) / 60000;
          const currentWPM = elapsedMinutes > 0 ? (this.wordCount + interimWords) / elapsedMinutes : 0;

          // Process Acoustic Energy (RMS)
          this.analyser!.getByteTimeDomainData(dataArray);
          let sumSquares = 0;
          for (let i = 0; i < dataArray.length; i++) {
            const normalized = (dataArray[i] / 128.0) - 1.0;
            sumSquares += normalized * normalized;
          }
          const rms = Math.sqrt(sumSquares / dataArray.length);
          const vocalEnergy = Math.min(100, rms * 500); // Scaled 0-100

          onTick({
            speechRate: currentWPM, // Words Per Minute
            vocalEnergy: vocalEnergy // Proxy for emotional intensity/pitch variance
          });
        };

        this.recognition.start();
      }
    } catch (error) {
      console.warn("Microphone access denied or unsupported.", error);
    }
  }

  stop() {
    this.isRunning = false;
    if (this.recognition) this.recognition.stop();
    if (this.audioContext) this.audioContext.close();
  }
}