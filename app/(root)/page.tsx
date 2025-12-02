

export default function Home() {
  return (
    <div>
      Home
      <p>
        Lorem ipsum dolor sit amet consectetur adipisicing elit. Deserunt et
        iusto, adipisci itaque architecto, exercitationem earum illum dicta
        consequuntur ipsum, accusamus accusantium beatae delectus suscipit
        impedit praesentium ullam placeat vitae!
      </p>
      <h2>{"text"}</h2>
      {process.env.VERCEL_URL! || "No"}
      <p className="text-accent-text">Accent text</p>
    </div>
  );
}
