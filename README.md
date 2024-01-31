# Monocuco
> Diccionario de palabras y frases costeñas.

![Uptime Badge](https://uptime.donado.co/api/badge/4/uptime/24) ![Uptime Badge](https://uptime.donado.co/api/badge/4/ping/24)

<img width="1400" alt="image" src="https://user-images.githubusercontent.com/27580836/233056568-b9985fb4-27ae-47e5-a663-48d9c1619411.png">

## Objetivo

Construir el más grande disccionario de palabras y frases propias de la Costa Caribe Colombiana.

## ¿Cómo contribuir?

Si has trabajado antes con React crea/selecciona un issue y sube el PR con la mejora.
Si deseas añadir nuevas palabras al diccionario, realiza los siguientes pasos:

### Si eres desarrollador

1. Haz un fork de este repo
2. Para añadir una nueva palabra lo puedes hacer de dos maneras:

**Usando el CLI (Nuevo!)**
Ingresa a tu consola:

```bash
  npm run cli
```

Y luego ingresas la información en consola a medida que se vaya pidiendo:

```bash
? Palabra Jodido
? Significado Persona que está mal
? Sinónimos (separados por coma) salado
? Por favor, escribe un ejemplo por línea. Received
? ¿Cuál es tu nombre? Wilson Tovar
? ¿Cuál es el link de tu cuenta en GitHub? https://github.com/krthr

¡Nueva palabra agregada correctamente! ¡Gracias!
Ya puedes crear el commit y subir el PR. ;)
```

**Editando archivo**
Agrega la nueva palabra directamente en el archivo `src/data.json`, asegurate de seguir esta estructura:

```json
  "text": "Monocuco",
  "meaning": "Palabra utilizada para referirse a algo que está bien o es bonito. Figura del carnaval de barranquilla.",
  "synonyms": [],
  "examples": [
    "‘Con esta pinta nueva quedé monocuco’",
    "‘Mira, ahí viene bailando el monocuco’"
  ],
  "authors": [{
    "name": "Javier Valencia",
    "link": "https://github.com/jvalenciae"
  }]
```

3. Crea el pull request
4. (Opcional) Añade tu perfil a la lista de contribuidores 😎 (no cambies el orden)
5. ¡Listo!

### Si no eres desarrollador

1. Envíame un email [jsrd98@gmail.com](mailto:jsrd98@gmail.com) con la siguiente información:

- Palabra
- Significado
- Sinónimos (opcional)
- Ejemplos (máximo dos)
- Tu página personal, o algún link para que puedan buscarte
- Tu nombre

2. En el asunto coloca: Nueva palabra - Monocuco
3. ¡Listo!

## Contribuidores

<table>
  <tr>
    <td align="center">
      <a href="https://github.com/sjdonado">
        <img src="https://avatars.githubusercontent.com/u/27580836?s=460" alt="Juan Rodriguez" />
        <br />
        <sub>
          <b>Juan Rodriguez</b>
        </sub>
      </a>
    </td>
    <td align="center">
      <a href="https://github.com/krthr">
        <img src="https://avatars.githubusercontent.com/u/18665740?s=460" alt="Wilson Tovar" />
        <br />
        <sub>
          <b>Wilson Tovar</b>
        </sub>
      </a>
    </td>
    <td align="center">
      <a href="https://github.com/jvalenciae">
        <img src="https://avatars.githubusercontent.com/u/44078264?s=460" alt="Javier Valencia" />
        <br />
        <sub>
          <b>Javier Valencia</b>
        </sub>
      </a>
    </td>
    <td align="center">
      <a href="https://github.com/C9-LinkRs">
        <img src="https://avatars.githubusercontent.com/u/23248296?s=460" alt="Johnny Villegas" />
        <br />
        <sub>
          <b>Johnny Villegas</b>
        </sub>
      </a>
    </td>
    <td align="center">
      <a href="https://github.com/fokobot">
        <img src="https://avatars.githubusercontent.com/u/25647093?s=460" alt="fokobot" />
        <br />
        <sub>
          <b>fokobot</b>
        </sub>
      </a>
    </td>
    <td align="center">
      <a href="https://github.com/herasj">
        <img src="https://avatars.githubusercontent.com/u/25647268?s=460" alt="Juan Rambal" />
        <br />
        <sub>
          <b>Juan Rambal</b>
        </sub>
      </a>
    </td>
  </tr>
  <tr>
    <td align="center">
      <a href="https://github.com/Yenniferh">
        <img src="https://avatars.githubusercontent.com/u/19285706?s=460" alt="Yennifer Herrera" />
        <br />
        <sub>
          <b>Yennifer Herrera</b>
        </sub>
      </a>
    </td>
    <td align="center">
      <a href="https://github.com/jaravad">
        <img src="https://avatars.githubusercontent.com/u/30931849?s=460" alt="Jesus Santiago" />
        <br />
        <sub>
          <b>Jesus Santiago</b>
        </sub>
      </a>
    </td>
    <td align="center">
      <a href="https://github.com/oskhar1099">
        <img src="https://avatars.githubusercontent.com/u/44534546?s=460" alt="Oskhar Arrieta" />
        <br />
        <sub>
          <b>Oskhar Arrieta</b>
        </sub>
      </a>
    </td>
    <td align="center">
      <a href="https://github.com/kristellu">
        <img src="https://avatars.githubusercontent.com/u/28717626?s=460" alt="Kristell Urueta" />
        <br />
        <sub>
          <b>Kristell Urueta</b>
        </sub>
      </a>
    </td>
    <td align="center">
      <a href="https://github.com/juandavid716">
        <img src="https://avatars.githubusercontent.com/u/42303342?s=460" alt="Juan Bojato" />
        <br />
        <sub>
          <b>Juan Bojato</b>
        </sub>
      </a>
    </td>
    <td align="center">
      <a href="https://github.com/pygabo">
        <img src="https://avatars.githubusercontent.com/u/17889145?s=460" alt="Jose Guzman" />
        <br />
        <sub>
          <b>Jose Guzman</b>
        </sub>
      </a>
    </td>
  </tr>
  <tr>
    <td align="center">
      <a href="https://github.com/Rafaell416">
        <img src="https://avatars.githubusercontent.com/u/18080929?s=460" alt="Rafael Villarreal" />
        <br />
        <sub>
          <b>Rafael Villarreal</b>
        </sub>
      </a>
    </td>
    <td align="center">
      <a href="https://github.com/Rome96">
        <img src="https://avatars.githubusercontent.com/u/19671381?s=460" alt="Turiano Romero" />
        <br />
        <sub>
          <b>Turiano Romero</b>
        </sub>
      </a>
    </td>
    <td align="center">
      <a href="https://github.com/Isaiasdelahoz">
        <img src="https://avatars.githubusercontent.com/u/25128103?s=460" alt="Isaias De la Hoz" />
        <br />
        <sub>
          <b>Isaías De la Hoz</b>
        </sub>
      </a>
    </td>
    <td align="center">
      <a href="https://github.com/jbolivard">
        <img src="https://avatars.githubusercontent.com/u/62828937?s=460" alt="Jorge Bolivar" />
        <br />
        <sub>
          <b>Jorge Bolivar</b>
        </sub>
      </a>
    </td>
    <td align="center">
      <a href="https://github.com/cesc1989">
        <img src="https://avatars.githubusercontent.com/u/1375981?s=460" alt="Francisco Quintero" />
        <br />
        <sub>
          <b>Francisco Quintero</b>
        </sub>
      </a>
    </td>
    <td align="center">
      <a href="https://github.com/wgarcia1309">
        <img src="https://avatars.githubusercontent.com/u/20034079?s=460" alt="Willian Garcia" />
        <br />
        <sub>
          <b>Willian Garcia</b>
        </sub>
      </a>
    </td>
  </tr>
  <tr>
    <td align="center">
      <a href="https://github.com/gmmonsalve">
        <img src="https://avatars.githubusercontent.com/u/30907973?s=460" alt="Gabriela Monsalve" />
        <br />
        <sub>
          <b>Gabriela Monsalve</b>
        </sub>
      </a>
    </td>
    <td align="center">
      <a href="https://github.com/hackvan">
        <img src="https://avatars.githubusercontent.com/u/179497?s=460" alt="Diego Camacho" />
        <br />
        <sub>
          <b>Diego Camacho</b>
        </sub>
      </a>
    </td>
    <td align="center">
      <a href="https://github.com/ferch5003">
        <img src="https://avatars.githubusercontent.com/u/26355409?s=460" alt="Fernando Visbal" />
        <br />
        <sub>
          <b>Fernando Visbal</b>
        </sub>
      </a>
    </td>
    <td align="center">
      <a href="https://github.com/javierdaza">
        <img src="https://avatars.githubusercontent.com/u/3085051?s=460" alt="Javier Daza" />
        <br />
        <sub>
          <b>Javier Daza</b>
        </sub>
      </a>
    </td>
    <td align="center">
      <a href="https://github.com/rmacuna">
        <img src="https://avatars.githubusercontent.com/u/25620714?s=460" alt="Roberto Acuña" />
        <br />
        <sub>
          <b>Roberto Acuña</b>
        </sub>
      </a>
    </td>
    <td align="center">
      <a href="https://github.com/barcasnerd">
        <img src="https://avatars.githubusercontent.com/u/49013288?s=460" alt="Jair Barcasnegras" />
        <br />
        <sub>
          <b>Jair Barcasnegras</b>
        </sub>
      </a>
    </td>
  </tr>
<table>

## Agradecimientos

- Andres Urquina: Autor del icono [Ilustración Bailarina - Carnaval de Barranquilla, Colombia.](https://www.flickr.com/photos/andresurquina/16246891029)
