# Monocuco
> Diccionario de palabras y frases costeñas.

<div align="center">
  <a href="monocuco-f4976.firebaseapp.com">
    <img src="/src/icon.jpg" alt="Monocuco" width="300px" />
  </a>
</div>

## Objetivo
Crear el más grande conjunto de palabras y frases usadas en la Costa Caribe Colombiana.

## ¿Cómo contribuir?
Monocuco está desarrollada con React.js. Si quieres proponer una mejora, arreglar algún problema o añadir nuevas palabras al diccionario, realiza los siguientes pasos:

### Si eres desarrollador
1. Crea el fork
2. Crea una nueva rama con uno de estos nombres: fix (solucionar bug), feature (mejora) o new-word (añadir nueva palabra)
3. Puedes añadir la palabra de dos maneras:

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
Ya puedes hacer commit y realizar el PR. ;)
```

**Editando archivo**  
Agrega la entrada directamente en el archivo `src/data.json` siguiendo esta estructura:

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
6. Crea el pull request
7. Opcional: Añadate en la lista de contribuidores &#128526; (no cambies el orden)
8. Listo!

Si tienes alguna duda respecto a tu contribución puedes unirte a nuestro canal de slack [aqui](https://barranquillajs.slack.com/join/shared_invite/enQtNDI1OTYwOTE2MjQwLTJhYWIzOGJhZDQ3NDljYmMyZjNiMzUwYWM0ZGMwYTliMWRhYmQ2ZjVhODM4MjE2OTg4YTEwYTQzMjAzMzA1Mzc), Al entrar al espacio de trabajo de slack ve a la sección de canales busca el canal #monocuco y únete.

### Si no eres desarrollador
1. Envíame un email a [jsrd98@gmail.com](mailto:jsrd98@gmail.com) con la siguiente información:

- Palabra
- Significado
- Sinónimos (opcional)
- Ejemplos (máximo dos)
- Tu página personal, o algún link para que puedan buscarte
- Tu nombre

2. En el asunto coloca: Nueva palabra - Monocuco
3. Listo!

## Contribuidores
<table>
  <tr>
    <td align="center"><a href="https://github.com/sjdonado"><img src="https://avatars0.githubusercontent.com/u/27580836?s=460&v=4" width="460" alt="Juan Rodriguez"/><br /><sub><b>Juan Rodriguez</b></sub></a></td>
    <td align="center"><a href="https://github.com/krthr"><img src="https://avatars0.githubusercontent.com/u/18665740?s=460&v=4" width="460" alt="Wilson Tovar"/><br /><sub><b>Wilson Tovar</b></sub></a></td>
    <td align="center"><a href="https://github.com/jvalenciae"><img src="https://avatars0.githubusercontent.com/u/44078264?s=460&v=4" width="460" alt="Javier Valencia"/><br /><sub><b>Javier Valencia</b></sub></a></td>
    <td align="center"><a href="https://github.com/C9-LinkRs"><img src="https://avatars0.githubusercontent.com/u/23248296?s=460&v=4" width="460" alt="Johnny Villegas"/><br /><sub><b>Johnny Villegas</b></sub></a></td>
    <td align="center"><a href="https://github.com/fokobot"><img src="https://avatars0.githubusercontent.com/u/25647093?s=460&v=4" width="460" alt="fokobot"/><br /><sub><b>fokobot</b></sub></a></td>
    <td align="center"><a href="https://github.com/herasj"><img src="https://avatars0.githubusercontent.com/u/25647268?s=460&v=4" width="460" alt="Juan Rambal"/><br /><sub><b>Juan Rambal</b></sub></a></td>
    <td align="center"><a href="https://github.com/Yenniferh"><img src="https://avatars0.githubusercontent.com/u/19285706?s=460&v=4" width="460" alt="Yennifer Herrera"/><br /><sub><b>Yennifer Herrera</b></sub></a></td>
  </tr>
  <tr>
    <td align="center"><a href="https://github.com/jaravad"><img src="https://avatars0.githubusercontent.com/u/30931849?s=460&v=4" width="460" alt="Jesus Santiago"/><br /><sub><b>Jesus Santiago</b></sub></a></td>
    <td align="center"><a href="https://github.com/oskhar1099"><img src="https://avatars0.githubusercontent.com/u/44534546?s=460&v=4" width="460" alt="Oskhar Arrieta"/><br /><sub><b>Oskhar Arrieta</b></sub></a></td>
    <td align="center"><a href="https://github.com/kristellu"><img src="https://avatars0.githubusercontent.com/u/28717626?s=460&v=4" width="460" alt="Kristell Urueta"/><br /><sub><b>Kristell Urueta</b></sub></a></td>
    <td align="center"><a href="https://github.com/juandavid716"><img src="https://avatars0.githubusercontent.com/u/42303342?s=460&v=4" width="460" alt="Juan Bojato"/><br /><sub><b>Juan Bojato</b></sub></a></td>
    <td align="center"><a href="https://github.com/pygabo"><img src="https://avatars0.githubusercontent.com/u/17889145?s=460&v=4" width="460" alt="Jose Guzman"/><br /><sub><b>Jose Guzman</b></sub></a></td>
    <td align="center"><a href="https://github.com/Rafaell416"><img src="https://avatars0.githubusercontent.com/u/18080929?s=460&v=4" width="460" alt="Rafael Villarreal"/><br /><sub><b>Rafael Villarreal</b></sub></a></td>
    <td align="center"><a href="https://github.com/Rome96"><img src="https://avatars0.githubusercontent.com/u/19671381?s=460&v=4" width="460" alt="Turiano Romero"/><br /><sub><b>Turiano Romero</b></sub></a></td>
  </tr>
  <tr>
    <td align="center"><a href="https://github.com/Isaiasdelahoz"><img src="https://avatars0.githubusercontent.com/u/25128103?s=460&v=4" width="460" alt="Isaias De la Hoz"/><br /><sub><b>Isaías De la Hoz</b></sub></a></td>
    <td align="center"><a href="https://github.com/jbolivard"><img src="https://avatars0.githubusercontent.com/u/62828937?s=460&v=4" width="460" alt="Jorge Bolivar"/><br /><sub><b>Jorge Bolivar</b></sub></a></td>
    <td align="center"><a href="https://github.com/cesc1989"><img src="https://avatars0.githubusercontent.com/u/1375981?s=460&v=4" width="460" alt="Francisco Quintero"/><br /><sub><b>Francisco Quintero</b></sub></a></td>
    <td align="center"><a href="https://github.com/wgarcia1309"><img src="https://avatars0.githubusercontent.com/u/20034079?s=460&v=4" width="460" alt="Willian Garcia"/><br /><sub><b>Willian Garcia</b></sub></a></td>
    <td align="center"><a href="https://github.com/gmmonsalve"><img src="https://avatars0.githubusercontent.com/u/30907973?s=460&u=7ad8f8e43b1edd78c7d4844fcb33368cd448f5bc&v=4" width="460" alt="Gabriela Monsalve"/><br /><sub><b>Gabriela Monsalve</b></sub></a></td>
    <td align="center"><a href="https://github.com/hackvan"><img src="https://avatars2.githubusercontent.com/u/179497?s=460&u=e039e64cb75b8012675addbf3cfee5ccc111b7c4&v=4" width="460" alt="Diego Camacho"/><br /><sub><b>Diego Camacho</b></sub></a></td>
  </tr>
<table>

## Agradecimientos especiales
- Andres Urquina: Autor del icono [Ilustración Bailarina - Carnaval de Barranquilla, Colombia.](https://www.flickr.com/photos/andresurquina/16246891029)
