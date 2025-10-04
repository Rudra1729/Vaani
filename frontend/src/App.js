import React from "react";
import Header from "./components/Header";
import MainContent from "./components/MainContent";
import "./App.css";
import ResearchPapers from "./components/ResearchPapers";
import { BrowserRouter ,Routes,Route} from "react-router-dom";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Define the routes */}
        <Route path="/" element={<HeaderAndMainContent />} />
        <Route path="/research" element={<ResearchPapers />} />
      </Routes>
    </BrowserRouter>
  );
}

const HeaderAndMainContent = () => {
  return (
    <div className="container">
      <Header />
      <MainContent />
    </div>
  );
};

export default App;
