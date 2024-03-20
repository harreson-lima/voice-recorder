// Variables
// Visualizer
const containerSize = document.querySelector(".recorder");
const canvas = document.querySelector(".visualizer");
const canvasCtx = canvas.getContext("2d");
// Audio
const recorderSection = document.querySelector(".recorder");
const appCoverSection = document.querySelector(".app-cover");
const recordBtn = document.querySelector(".record");
const pauseBtn = document.querySelector(".pause");
const resumeBtn = document.querySelector(".resume")
const stopBtn = document.querySelector(".stop");
const audiosClips = document.querySelector(".audios");
// DB
let db;
const indexedDB = window.indexedDB;
// Duration
const duration = document.querySelector(".duration");
let seconds = 0;
let minutes = 0;
let crono;

// Audio visualiser

function visualizer(stream) {
  canvas.width = containerSize.offsetWidth * 0.8;
  const HEIGHT = canvas.height;
  let WIDTH = canvas.width;
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const source = audioContext.createMediaStreamSource(stream);
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 2048;

  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  const barWidth = WIDTH / bufferLength + 8;

  source.connect(analyser);

  canvasCtx.clearRect(0, 0, WIDTH, HEIGHT);

  draw();

  function draw() {
    // console.log(1);

    drawVisual = requestAnimationFrame(draw);

    analyser.getByteFrequencyData(dataArray);

    canvasCtx.fillStyle = "#0b0f14";
    canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);

    let barHeight;
    let x = 0;
    let y;
    const grd = canvasCtx.createLinearGradient(100, 0, 100, 100);
    grd.addColorStop(0.5, "#1FCEE5");
    grd.addColorStop(1, "#8512E2");
    for (let i = 0; i < bufferLength; i++) {
      if (x + 8 < WIDTH) {
        barHeight = dataArray[i] / 2;
        barHeight = barHeight > 10 ? barHeight : 10;
        y = HEIGHT - barHeight / 2 - 75;

        canvasCtx.beginPath();
        canvasCtx.fillStyle = grd;
        canvasCtx.roundRect(x, y, barWidth, barHeight, 200);
        canvasCtx.fill();
        x += barWidth + 8;
      }
    }
  }
}

// Database

if (!indexedDB) {
  console.log("IndexedDB could not be found in this browser.");
}

// Open indexedDB
const openOrCreateDB = indexedDB.open("AudiosDatabase", 1);

openOrCreateDB.onerror = (e) => {
  console.error(`A error ocurred with indexedDB: ${e}`);
};

openOrCreateDB.onsuccess = () => {
  console.log("Successfully opened DB");
  db = openOrCreateDB.result;
  showAudioClips();
};

openOrCreateDB.onupgradeneeded = (e) => {
  db = e.target.result;

  db.onerror = () => {
    console.error("Error loading database.");
  };

  const table = db.createObjectStore("Audios", {
    keyPath: "id",
    autoIncrement: true,
  });

  table.createIndex("audio", "audio", { unique: false });
  table.createIndex("label", "label", { unique: false });
};

// Add a new audio to the Database
function addAudio(blob, label) {
  const newAudio = {
    audio: blob,
    label: label !== "" && label !== null ? label : "Audio_label",
  };
  const transaction = db.transaction(["Audios"], "readwrite");
  const objectStore = transaction.objectStore("Audios");
  objectStore.add(newAudio);
}

// Get the audios from the database and display it
function showAudioClips() {
  audiosClips.innerHTML = "";

  const objectStore = db.transaction("Audios").objectStore("Audios");

  objectStore.openCursor().onsuccess = (e) => {
    const pointer = e.target.result;

    if (pointer) {
      const clipContainer = document.createElement("article");
      const clipLabel = document.createElement("p");
      const audio = document.createElement("audio");
      const deleteBtn = document.createElement("button");
      const downloadBtn = document.createElement("a");

      clipContainer.classList.add("clip");
      clipContainer.setAttribute("data-id", pointer.value.id);
      clipLabel.innerHTML = pointer.value.label;
      clipLabel.classList.add("label");
      audio.setAttribute("controls", "");
      deleteBtn.innerHTML = "Delete";
      downloadBtn.innerHTML = "Download";
      downloadBtn.setAttribute("download", pointer.value.label);

      clipContainer.appendChild(clipLabel);
      clipContainer.appendChild(audio);
      clipContainer.appendChild(deleteBtn);
      clipContainer.appendChild(downloadBtn);
      audiosClips.appendChild(clipContainer);

      audio.controls = true;
      const audioURL = window.URL.createObjectURL(pointer.value.audio);
      audio.src = audioURL;
      downloadBtn.setAttribute("href", audioURL);

      deleteBtn.addEventListener("click", deleteAudio);
      clipLabel.addEventListener("click", updateAudioLabel);
      pointer.continue();
    }
  };
}

function deleteAudio(e) {
  const audioId = parseInt(e.target.parentNode.getAttribute("data-id"));
  const transaction = db.transaction(["Audios"], "readwrite");
  const objectStore = transaction.objectStore("Audios");
  objectStore.delete(audioId);
  transaction.oncomplete = () => {
    e.target.parentNode.parentNode.removeChild(e.target.parentNode);
    console.log("audio removed!");
  };
  transaction.onerror = () => {
    console.error("Delete transaction error");
  };
}


function updateAudioLabel(e) {
  const newlabel = prompt("Enter a new name for the sound clip");

  if (newlabel === "" || newlabel === null) {
    return;
  }

  const audioId = parseInt(e.target.parentNode.getAttribute("data-id"));
  const transaction = db.transaction(["Audios"], "readwrite");
  const objectStore = transaction.objectStore("Audios");

  const query = objectStore.get(audioId);

  query.onsuccess = () => {
    const newAudio = query.result;
    newAudio.label = newlabel;

    const updateAudio = objectStore.put(newAudio);

    updateAudio.onsuccess = () => {
      showAudioClips();
    };

    updateAudio.onerror = () => {
      console.error("Update transaction error");
    };
  };
}

// Checks if browser support getUserMedia
if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
  console.log("getUserMedia supported!");

  const constraints = { audio: true };
  let chunks = [];

  // Set up MediaRecorder functions if getUserMedia is a success
  function onSuccess(stream) {
    const mediaRecorder = new MediaRecorder(stream);

    recordBtn.addEventListener("click", () => {
      mediaRecorder.start();
      console.log(mediaRecorder.state);
      console.log("start recording");
      recordBtn.classList.add("recording");
      appCoverSection.style.display = "none";
      recorderSection.style.display = "flex";
      resumeBtn.style.display = "none";
      visualizer(stream);
      startCrono();
    });

    stopBtn.addEventListener("click", () => {
      mediaRecorder.stop();
      console.log(mediaRecorder.state);
      console.log("stop recording");
    });

    pauseBtn.addEventListener("click", () => {
      console.log("enter here");
      mediaRecorder.pause();
      pauseCrono();
      console.log(mediaRecorder.state);
      pauseBtn.style.display = "none";
      resumeBtn.style.display = "flex";
    });

    resumeBtn.addEventListener("click", () => {
      mediaRecorder.resume();
      startCrono();
      console.log(mediaRecorder.state);
      resumeBtn.style.display = "none";
      pauseBtn.style.display = "flex";
    });

    // Is triggered every time the recorder is stopped, then gets all the data
    // and creates a clip element and reset the chunks for the next record
    mediaRecorder.onstop = (e) => {
      console.log("record stopped");
      const label = prompt("Enter a name for the sound clip");

      const blob = new Blob(chunks, { type: "audio/mp3; codecs=opus" });

      addAudio(blob, label);
      chunks = [];
      appCoverSection.style.display = "flex";
      recorderSection.style.display = "none";
      resetCrono();
      showAudioClips();
    };

    mediaRecorder.ondataavailable = (e) => {
      chunks.push(e.data);
    };
  }

  function onError(err) {
    console.error(`The following erro occured ${err}`);
  }
  navigator.mediaDevices.getUserMedia(constraints).then(onSuccess, onError);
} else {
  console.log("getUserMedia not supported!");
}

function startCrono() {
  pauseCrono();
  crono = setInterval(() => {
    timer();
  }, 1000);
}

function pauseCrono() {
  clearInterval(crono);
}

function resetCrono() {
  pauseCrono();
  seconds = 0;
  minutes = 0;
  duration.innerHTML = "00:00";
}

function timer() {
  

  if (seconds < 60) {
    seconds++;
  } else {
    minutes++;
    seconds = 0;
  }

  duration.innerHTML = `${minutes.toString().padStart(2, "0")}` 
    + ":" + `${seconds.toString().padStart(2, "0")}`;
}
