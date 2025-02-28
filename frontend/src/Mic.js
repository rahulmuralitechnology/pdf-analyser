import React, { useState } from "react";
import SpeechRecognition, { useSpeechRecognition } from "react-speech-recognition";
import "./App.css";

const App = () => {
    const [isListening, setIsListening] = useState(false);
    const { transcript, browserSupportsSpeechRecognition, resetTranscript } = useSpeechRecognition();

    if (!browserSupportsSpeechRecognition) {
        return <p>Your browser does not support speech recognition.</p>;
    }

    const startListening = () => {
        console.log("Starting listening...");
        SpeechRecognition.startListening({ continuous: true, language: "en-IN" });
        setIsListening(true);
    };

    const stopListening = () => {
        console.log("Stopping listening...");
        SpeechRecognition.stopListening();
        setIsListening(false);
    };

    return (
        <div className="container">
            <h2>Speech to Text Converter</h2>
            <p>A React app that converts speech to text.</p>
            
            <div className="main-content">
                {transcript ? <p>{transcript}</p> : <p>No speech detected...</p>}
            </div>

            <div className="btn-style">
                <button onClick={startListening} disabled={isListening}>Start Listening</button>
                <button onClick={stopListening} disabled={!isListening}>Stop Listening</button>
                <button onClick={resetTranscript}>Clear Text</button>
            </div>
        </div>
    );
};

export default App;
