import React from "react";
import Header from "./components/Header";
import HomePage from "./pages/HomePage";
import ResearchPapers from "./components/ResearchPapers";
import PDFViewer from "./components/PDFViewer";
import "./App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";

function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <Header />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/research" element={<ResearchPapers />} />
            <Route path="/pdf-viewer" element={<PDFViewer />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
