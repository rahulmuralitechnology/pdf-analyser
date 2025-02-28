import React, { useState, useEffect, useRef } from "react";
import { Upload, Send, Mic, Volume2, Loader2, FileText } from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import "pdfjs-dist/build/pdf.worker.mjs";
import "./App.css";
import ReactMarkdown from "react-markdown";

const { GoogleGenerativeAI } = require("@google/generative-ai");

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

const App = () => {
  const [file, setFile] = useState(null);
  const [documentText, setDocumentText] = useState("");
  const [question, setQuestion] = useState("");
  const [language, setLanguage] = useState("en");
  const [response, setResponse] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [messages, setMessages] = useState([]);
  
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const languages = [
    { code: "en", name: "English" },
    { code: "ta", name: "Tamil" },
    { code: "hi", name: "Hindi" },
    { code: "ml", name: "Malayalam" }
  ];

  useEffect(() => {
    if (file) {
      processPdf();
    }
  }, [file]);
  
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const processPdf = async () => {
    if (!file) return;

    setIsExtracting(true);
    try {
      const reader = new FileReader();
      reader.readAsArrayBuffer(file);
      reader.onload = async (e) => {
        const typedArray = new Uint8Array(e.target.result);
        const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;

        let extractedText = "";
        const totalPages = pdf.numPages;

        for (let i = 1; i <= totalPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          extractedText += textContent.items.map((item) => item.str).join(" ") + "\n";
        }

        setDocumentText(extractedText);
        setMessages(prev => [...prev, {
          type: "system",
          content: `Document "${file.name}" (${totalPages} pages) processed successfully.`
        }]);
      };
    } catch (error) {
      console.error("Error processing PDF:", error);
      setMessages(prev => [...prev, {
        type: "system",
        content: "Error processing PDF. Please try again."
      }]);
    } finally {
      setIsExtracting(false);
    }
  };

  const getAIResponse = async (query, context, targetLanguage) => {
    try {
      const apiKey = "AIzaSyA70zT8EVJV-8WM88LoadnFAKW8dfjrp2g";
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const prompt = `
      Based on the document content: ${context}
      
      Question: ${query}
      
      Please provide a comprehensive answer based only on the document content. Respond in ${getLanguageName(targetLanguage)} language.
      `;

      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      console.error("Error fetching AI response:", error);
      return "Failed to get AI response.";
    }
  };

  const getLanguageName = (code) => {
    const lang = languages.find(l => l.code === code);
    return lang ? lang.name : "English";
  };

  const handleAskQuestion = async () => {
    if (!documentText) {
      setMessages(prev => [...prev, {
        type: "system",
        content: "Please upload a PDF first."
      }]);
      return;
    }
    if (!question.trim()) {
      setMessages(prev => [...prev, {
        type: "system",
        content: "Please enter a question."
      }]);
      return;
    }

    setMessages(prev => [...prev, {
      type: "user",
      content: question
    }]);

    setIsProcessing(true);
    try {
      const answer = await getAIResponse(question, documentText, language);

      setMessages(prev => [...prev, {
        type: "assistant",
        content: answer
      }]);

      setResponse(answer);
      generateAudioResponse(answer);
    } catch (error) {
      setMessages(prev => [...prev, {
        type: "system",
        content: "Error getting answer. Please try again."
      }]);
    } finally {
      setIsProcessing(false);
      setQuestion("");
    }
  };

  const generateAudioResponse = (text) => {
    if (!text) return;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);

    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  const handleVoiceInput = () => {
    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

      if (!SpeechRecognition) {
        setMessages(prev => [...prev, {
          type: "system",
          content: "Voice recognition not supported in this browser."
        }]);
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.lang = language;
      recognition.start();
      setIsRecording(true);

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setQuestion(transcript);
        setIsRecording(false);
      };

      recognition.onerror = (event) => {
        console.error("Speech recognition error", event);
        setMessages(prev => [...prev, {
          type: "system",
          content: "Error with voice recognition. Please try again."
        }]);
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };
    } catch (error) {
      console.error("Error initializing speech recognition:", error);
      setMessages(prev => [...prev, {
        type: "system",
        content: "Voice recognition failed to initialize."
      }]);
      setIsRecording(false);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAskQuestion();
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current.click();
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1 className="app-title">Document Q&A Chat</h1>
        
        <div className="header-controls">
          <div className="language-selector">
            <label className="language-label">Language:</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="language-select"
            >
              {languages.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name}
                </option>
              ))}
            </select>
          </div>
          
          <div className="file-upload-container">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".pdf"
              id="pdf-upload"
              className="file-input-hidden"
            />
            <button
              onClick={triggerFileInput}
              className="upload-button"
            >
              <Upload size={16} className="icon-left" /> 
              {file ? 'Change PDF' : 'Upload PDF'}
            </button>
          </div>
        </div>
      </header>

      {file && (
        <div className="document-info-bar">
          <div className="document-name">
            <FileText size={16} className="icon-document" />
            <span className="document-filename">{file.name}</span>
          </div>
          
          {isExtracting ? (
            <div className="extraction-status">
              <Loader2 size={14} className="icon-spinner" />
              <span>Processing PDF...</span>
            </div>
          ) : (
            documentText && (
              <span className="document-stats">
                {documentText.length.toLocaleString()} chars extracted
              </span>
            )
          )}
        </div>
      )}

      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="empty-state">
            <FileText size={48} className="empty-icon" />
            <p className="empty-text">Upload a PDF and ask questions about its content</p>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div
              key={index}
              className={`message ${msg.type}-message`}
            >
              <p className="message-content"><ReactMarkdown>{msg.content}</ReactMarkdown></p>
              
              
              {msg.type === 'assistant' && (
                <button
                  onClick={() => generateAudioResponse(msg.content)}
                  title="Read aloud"
                  className="audio-button"
                >
                  <Volume2 size={16} />
                </button>
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="input-container">
        <div className="message-compose">
          <div className="textarea-wrapper">
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={`Ask a question in ${getLanguageName(language)}...`}
              rows={1}
              className="message-input"
            />
            <button
              onClick={handleVoiceInput}
              disabled={isRecording}
              title="Voice input"
              className="voice-button"
            >
              {isRecording ? (
                <Loader2 size={20} className="icon-spinner" />
              ) : (
                <Mic size={20} />
              )}
            </button>
          </div>

          <div className="action-buttons">
            {isSpeaking && (
              <button
                onClick={stopSpeaking}
                className="stop-audio-button"
              >
                Stop Audio
              </button>
            )}
            
            <button
              onClick={handleAskQuestion}
              disabled={isProcessing || !documentText}
              className={`send-button ${(isProcessing || !documentText) ? 'button-disabled' : ''}`}
            >
              {isProcessing ? (
                <>
                  <Loader2 size={16} className="icon-spinner icon-left" /> Processing...
                </>
              ) : (
                <>
                  <Send size={16} className="icon-left" /> Send
                </>
              )}
            </button>
          </div>
        </div>
        
        {!documentText && !isExtracting && (
          <p className="helper-text">
            Please upload a PDF document first to start asking questions
          </p>
        )}
      </div>
    </div>
  );
};

export default App;