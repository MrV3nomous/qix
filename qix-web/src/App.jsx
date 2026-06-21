import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Join from './pages/Join';
import Chat from './pages/Chat';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex items-center justify-center">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/join" element={<Join />} />
          <Route path="/chat/:roomId" element={<Chat />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;