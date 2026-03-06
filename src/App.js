import EnhancedNotionBooking from './components/EnhancedNotionBooking';
import './App.css';

function App() {
  // 現行UIは EnhancedNotionBooking を使用（旧 NotionBookingSystem / ModernBookingSystem は未使用）
  return (
    <div className="App">
      <EnhancedNotionBooking />
    </div>
  );
}

export default App;
