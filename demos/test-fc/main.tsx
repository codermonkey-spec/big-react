import React from 'react';
import ReactDOM from 'react-dom/client';

function App() {
	return <Child />;
}

function Child() {
	return <span>big-react</span>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
