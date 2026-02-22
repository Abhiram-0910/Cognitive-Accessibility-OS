export class VoiceBiomarkerEngine {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private recognition: any = null;
  private isRunning = false;
  private wordCount = 0;
  private startTime = 0;

  async startAnalysis(
    onTick: (metrics: { speechRate: number; vocalEnergy: number }) => void
  ) {
    this.isRunning = true;
    this.startTime = Date.now();
    this.wordCount = 0;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      this.audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();

      const source = this.audioContext.createMediaStreamSource(stream);

      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;

      source.connect(this.analyser);

      const dataArray = new Uint8Array(
        this.analyser.frequencyBinCount
      );

      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;

        this.recognition.onresult = (event: any) => {
          let interimWords = 0;

          for (
            let i = event.resultIndex;
            i < event.results.length;
            ++i
          ) {
            const transcript =
              event.results[i][0].transcript;

            if (event.results[i].isFinal) {
              this.wordCount += transcript
                .split(/\s+/)
                .filter(Boolean).length;
            } else {
              interimWords += transcript
                .split(/\s+/)
                .filter(Boolean).length;
            }
          }

          const elapsedMinutes =
            (Date.now() - this.startTime) / 60000;

          const currentWPM =
            elapsedMinutes > 0
              ? (this.wordCount + interimWords) /
                elapsedMinutes
              : 0;

          this.calculateEnergyAndEmit(
            dataArray,
            currentWPM,
            onTick
          );
        };

        this.recognition.start();
      } else {
        console.warn(
          "[NeuroAdaptive] Web Speech API not supported in this browser. Tracking vocal energy only."
        );

        setInterval(() => {
          if (this.isRunning)
            this.calculateEnergyAndEmit(
              dataArray,
              0,
              onTick
            );
        }, 1000);
      }
    } catch (error) {
      console.warn(
        "Microphone access denied or unsupported.",
        error
      );
    }
  }

  private calculateEnergyAndEmit(
    dataArray: Uint8Array,
    wpm: number,
    onTick: Function
  ) {
    if (!this.analyser) return;

    // ✅ FIXED CASTING HERE
    this.analyser.getByteTimeDomainData(
      dataArray as unknown as Uint8Array
    );

    let sumSquares = 0;

    for (let i = 0; i < dataArray.length; i++) {
      const normalized =
        dataArray[i] / 128.0 - 1.0;
      sumSquares += normalized * normalized;
    }

    const rms = Math.sqrt(
      sumSquares / dataArray.length
    );

    const vocalEnergy = Math.min(
      100,
      rms * 500
    );

    onTick({
      speechRate: wpm,
      vocalEnergy: vocalEnergy
    });
  }

  stop() {
    this.isRunning = false;

    if (this.recognition)
      this.recognition.stop();

    if (this.audioContext)
      this.audioContext.close();
  }
}