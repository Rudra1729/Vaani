import React from "react";
import Header from "./components/Header";
import HomePage from "./pages/HomePage";
import ResearchPapers from "./components/ResearchPapers";
import PDFViewer from "./components/PDFViewer";
import LanguageSelection from "./pages/LanguageSelection";
import { LanguageProvider } from "./lang/LanguageContext";
import "./App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";

function App() {
  return (
    <LanguageProvider>
      <BrowserRouter>
        <div className="app">
          <Header />
          <main className="main-content">
            <Routes>
              <Route path="/select-language" element={<LanguageSelection />} />
              <Route path="/" element={<HomePage />} />
              <Route path="/research" element={<ResearchPapers />} />
              <Route path="/pdf-viewer" element={<PDFViewer />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </LanguageProvider>
  );
}

export default App;
