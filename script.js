const recordToggleButton = document.getElementById("record-toggle");
const transcriptArea = document.getElementById("transcript");
const copyButton = document.getElementById("copy-text");
const viewNotesButton = document.getElementById("view-notes");
const canvas = document.getElementById('visualizer');
const ctx = canvas.getContext('2d');
const languageSelect = document.getElementById("language-select");

// Brauzer dəstəyini yoxlayırıq
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (!SpeechRecognition) {
    alert("Brauzeriniz səsli yazını dəstəkləmir. Zəhmət olmasa Google Chrome istifadə edin.");
}

const recognition = new SpeechRecognition();
recognition.interimResults = true;
recognition.continuous = true; // Dayanmadan yazması üçün vacibdir

let finalTranscript = '';
let mediaRecorder;
let audioChunks = [];
let audioContext;
let analyzer;
let source;
let isRecording = false; // Statusu izləmək üçün dəyişən

// Canvas ölçülərini tənzimləyək
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Səs tanıma nəticələri
recognition.onresult = event => {
    let interimTranscript = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
            finalTranscript += transcript + '. ';
        } else {
            interimTranscript += transcript;
        }
    }
    transcriptArea.value = finalTranscript + interimTranscript;
    scrollToBottom();
};

// Səs tanıma dayanarsa (amma biz dayandırmamışıqsa) yenidən başlasın
recognition.onend = () => {
    if (isRecording) {
        recognition.start();
    }
};

// Qeydi yaddaşa yazmaq
function saveRecording(text) {
    if (!text.trim()) return; // Boş mətni yazmayaq
    
    let notes = JSON.parse(localStorage.getItem('voiceNotes')) || [];
    notes.push({
        text,
        date: new Date().toLocaleString()
    });
    localStorage.setItem('voiceNotes', JSON.stringify(notes));
}

// Vizualizator funksiyası
function drawVisualizer() {
    if (!analyzer) return;
    
    const bufferLength = analyzer.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    function renderFrame() {
        if (!isRecording) return; // Yazmırsa, çizim dayansın

        requestAnimationFrame(renderFrame);
        analyzer.getByteFrequencyData(dataArray);
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const barWidth = (canvas.width / bufferLength) * 2.5;
        let barHeight;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            barHeight = dataArray[i] * 3; // Hündürlüyü tənzimlədik
            
            // Rəng effekti
            ctx.fillStyle = 'rgb(' + (barHeight + 100) + ',50,50)';
            ctx.fillRect(x, canvas.height - barHeight / 2, barWidth, barHeight / 2); // Aşağı hissə
            
            x += barWidth + 1;
        }
    }
    renderFrame();
}

// Dil dəyişimi
languageSelect.addEventListener("change", () => {
    recognition.lang = languageSelect.value;
});

// Düyməyə klikləmə məntiqi (Əsas Düzəliş Buradadır)
recordToggleButton.addEventListener("click", async () => {
    if (isRecording) {
        // --- DAYANDIR ---
        isRecording = false;
        recognition.stop();
        
        if (mediaRecorder && mediaRecorder.state !== "inactive") {
            mediaRecorder.stop();
        }
        
        // Audio konteksti bağlayaq ki, resurs yemisn
        if (audioContext) {
            audioContext.close();
            audioContext = null;
        }
        
        // Canvas-ı təmizlə
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        recordToggleButton.innerHTML = '<i class="fa-solid fa-microphone"></i>';
        
    } else {
        // --- BAŞLAT ---
        // Əvvəlki mətni təmizləmək istəyirsinizsə aşağıdakı sətri aktiv edin:
        // finalTranscript = ''; 
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // 1. Audio Visualizer üçün kontekst yaradılması
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            analyzer = audioContext.createAnalyser();
            source = audioContext.createMediaStreamSource(stream);
            source.connect(analyzer);
            analyzer.fftSize = 256;
            
            // 2. Media Recorder işə salınması
            mediaRecorder = new MediaRecorder(stream);
            mediaRecorder.start();
            
            mediaRecorder.addEventListener("stop", () => {
                // Səs faylını yadda saxlamaq üçün (hazırda sadəcə mətni saxlayırıq)
                saveRecording(transcriptArea.value);
            });

            // 3. Speech Recognition işə salınması
            recognition.lang = languageSelect.value;
            recognition.start();
            
            isRecording = true;
            drawVisualizer(); // Vizualizasiyanı başlat
            
            recordToggleButton.innerHTML = '<i class="fa-regular fa-microphone"></i>'; // İkonu dəyiş
            
        } catch (error) {
            console.error("Mikrofon xətası:", error);
            alert("Mikrofona icazə verilmədi və ya xəta baş verdi.");
        }
    }
});

// Digər köməkçi funksiyalar
copyButton.addEventListener("click", () => {
    transcriptArea.select();
    document.execCommand("copy");
    // Alternativ modern üsul: navigator.clipboard.writeText(transcriptArea.value);
});

viewNotesButton.addEventListener("click", () => {
    window.location.href = "view-notes.html";
});

function scrollToBottom() {
    transcriptArea.scrollTop = transcriptArea.scrollHeight;
}
