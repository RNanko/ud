const LoadingPage = () => {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        margin: "0 auto",
        height: "100vh",
        // width: "100vw",
      }}
    >
      <div className="flex items-end gap-2 h-8">
        <span className="block w-3 h-3 bg-chart-1 rounded-sm jump" />
        <span className="block w-3 h-3 bg-chart-2 rounded-sm jump" />
        <span className="block w-3 h-3 bg-chart-3 rounded-sm jump" />
      </div>
    </div>
  );
};

export default LoadingPage;
