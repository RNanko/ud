export default function layout({ children }) {
  return (
    <div className="h-screen flex flex-col">
      <header
        className="w-full p-5 px-7 flex flex-row 
        justify-between bg-blue-700 border-b-2 border-white"
      >
        <div className="flex flex-row gap-10">
          <a
            href="/repair"
            className="px-4 py-2 
          text-4xl font-bold 
          text-white
          hover:scale-105 
          cursor-pointer
          transition-all duration-200
          inline-block"
          >
            Repair
          </a>
          <a
            href="/registration"
            className="px-4 py-2 
          text-4xl font-bold 
          text-white
          hover:scale-105 
          cursor-pointer
          transition-all duration-200
          inline-block"
          >
            Registration
          </a>
        </div>

        <a
          href="/login"
          className="px-4 py-2 rounded-sm 
            text-2xl font-bold 
            bg-blue-600 text-white
            hover:scale-105 
            hover:shadow-lg 
            hover:shadow-blue-400/50
            hover:bg-blue-500
            cursor-pointer
            transition-all duration-200
            border-2 border-blue-400
            flex items-center justify-center
            w-32"
        >
          Logout
        </a>
      </header>
      <div className="flex-1 bg-accent">{children}</div>
    </div>
  );
}
