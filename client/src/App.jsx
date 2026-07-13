import GameTable from './components/GameTable';
import UiPreview from './dev/UiPreview';
import ThemeToggle from './components/ui/ThemeToggle';
import './App.css';

function App() {
  const previewState = import.meta.env.DEV
    ? new URLSearchParams(window.location.search).get('uiPreview')
    : null;

  return (
    <div className="App">
      <ThemeToggle />
      {previewState ? <UiPreview state={previewState} /> : <GameTable />}
    </div>
  );
}

export default App;
