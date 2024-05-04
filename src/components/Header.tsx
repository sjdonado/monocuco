import icon from '../icon.jpg';

export default function Header() {
  return (
    <>
      <img
        className="icon mx-auto max-h-64"
        src={icon}
        alt="Bailarina - Carnaval de Barranquilla, Colombia | Ilustración Andrés Urquina Sánchez"
      />
      <div className="title text-center">
        <h1 className="text-5xl">Monocuco</h1>
        <h5 className="text-xl font-italic">Diccionario de palabras y frases costeñas</h5>
      </div>
    </>
  );
}
