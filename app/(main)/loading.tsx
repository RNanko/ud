const LoadingPage = () => {
  return (
    // 1. Position fixed/absolute to cover the full screen (inset-0)
    // 2. Use the translate method to center the content div within this full space
    <div className="fixed inset-0 flex items-center justify-center">
      
      {/* This inner div is now centered using flexbox provided by the parent div */}
      <div className="flex items-center gap-2 h-8">
        <span className="block w-3 h-3 bg-chart-1 rounded-sm jump" />
        <span className="block w-3 h-3 bg-chart-2 rounded-sm jump" />
        <span className="block w-3 h-3 bg-chart-3 rounded-sm jump" />
      </div>
      
    </div>
  );
};

export default LoadingPage;
