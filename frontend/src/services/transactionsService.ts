const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
console.info(API_BASE_URL)
export const fetchTransactionsData = async () => {
  
  const response = await fetch(`${API_BASE_URL}/transactions/`);
  return response.json();
};