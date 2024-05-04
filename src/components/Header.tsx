import icon from '../icon.jpg';

export default function Header() {
  return (
    <div className="flex flex-col gap-2">
      <img
        className="mx-auto max-h-36"
        src={icon}
        alt="Bailarina - Carnaval de Barranquilla, Colombia | Ilustración Andrés Urquina Sánchez"
      />
      <div className="text-center">
        <h1 className="text-5xl">Monocuco</h1>
        <h5 className="text-xl italic">Diccionario de palabras y frases costeñas</h5>
      </div>
    </div>
  );
}
