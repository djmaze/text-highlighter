const originUrl = new URL(document.currentScript.src).origin

const peerScript = document.createElement('script');
peerScript.src = originUrl + "/simplepeer.min.js"
document.head.appendChild(peerScript);

const fuseScript = document.createElement('script');
fuseScript.src = originUrl + "/fuse.js"
document.head.appendChild(fuseScript);

let simplePeer

function showModal(html) {
  const modal = document.createElement('div');
  modal.id = 'modal';
  modal.style.display = 'none';
  modal.style.position = 'fixed';
  modal.style.zIndex = '1';
  modal.style.left = '0';
  modal.style.top = '0';
  modal.style.width = '100%';
  modal.style.height = '100%';
  modal.style.overflow = 'auto';
  modal.style.backgroundColor = 'rgba(0,0,0,0.4)';

  const modalContent = document.createElement('div');
  modalContent.className = 'modal-content';
  modalContent.style.backgroundColor = '#fefefe';
  modalContent.style.margin = '15% auto';
  modalContent.style.padding = '20px';
  modalContent.style.border = '1px solid #888';
  modalContent.style.overflow = 'hidden';   // TODO Good?
  modalContent.style.width = '80%';

  const close = document.createElement('span');
  close.className = 'close';
  close.style.color = '#aaa';
  close.style.float = 'right';
  close.style.fontSize = '28px';
  close.style.fontWeight = 'bold';
  close.textContent = 'X';
  close.addEventListener('click', function() {
    modal.style.display = 'none';
  });

  modalContent.innerHTML = html;
  modalContent.appendChild(close);
  modal.appendChild(modalContent);

  document.body.appendChild(modal);

  modal.style.display = 'block';
}

function initSimplePeer() {
  console.debug("initSimplePeer")

    simplePeer = new SimplePeer({
      //initiator: location.hash === '#1',
      initiator: true,
      trickle: false
    })

    simplePeer.on('error', err => console.log('error', err))

    simplePeer.on('signal', async (data) => {
      const offer = JSON.stringify(data)
      console.log('SIGNAL', offer)
      const html = `
        <button id="text-highlighter-copy-offer-to-clipboard">Copy offer to clipboard</button>
      `.replace(/  +/g, '')
      showModal(html)

      document.getElementById("text-highlighter-copy-offer-to-clipboard").addEventListener("click", async (ev) => {
        ev.preventDefault()
        await navigator.clipboard.writeText(offer)

        const text = `
        Offer has been copied to clipboard.

        1. Go to the other peer and paste the offer.
        2. Come back here and paste the answer.
        `.replace(/  +/g, '')
        const answer = prompt(text)
        if (answer) {
          simplePeer.signal(JSON.parse(answer))
        }
      })
    })

    simplePeer.on('connect', () => {
      console.log('CONNECT')
      document.querySelector("#modal").style.display = "none";
    })

    let lastMatching
    simplePeer.on('data', data => {
      console.log('data', data.toString())
      const textEncoder = new TextDecoder('utf-8');
      const string = textEncoder.decode(data).trim()
      console.log("string", string)

      const matching = findMatching(string)
      console.log("matching", matching)

      if (matching && (matching !== lastMatching)) {
        if (lastMatching)
          lastMatching.style.backgroundColor = "inherit";

        matching.style.backgroundColor = "yellow";
        scrollToElement(matching)

        lastMatching = matching
      }
    })
}

function scrollToElement(element) {
  //const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

  //window.scrollTo({
    //top: element.offsetTop + (viewportHeight * 1.5),
    //behavior: 'smooth'
  //});

  element.scrollIntoView({
    block: "center",
    behavior: 'smooth'
  })
}

function send(string) {
  simplePeer.send(string)
}

peerScript.onload = initSimplePeer

function findExactMatch(paragraphs, inputText) {
  console.debug("findExactMatch", paragraphs, inputText)

  const searchText = inputText.trim().toLowerCase()
  const matches = paragraphs.filter((p) => p.innerText.toLowerCase().includes(searchText))

  console.debug("exact matches", matches)

  if (matches.length === 1) return matches[0]
}

function findInParagraphs(paragraphs, inputText) {
  console.debug("findInParagraphs", paragraphs, inputText)

  const exactMatch = findExactMatch(paragraphs, inputText)
  if (exactMatch) {
    console.debug("found exact match", exactMatch)
    return {
      item: {
        p: exactMatch
      },
      score: 0
    }
  }

  const records = Array.from(paragraphs, (p) => { return {
    p: p,
    text: p.innerText
  }})


  const maxLength = paragraphs.reduce((max, current) => {
    return current.innerText.length > max ? current.innerText.length : max
  }, 0)

  console.debug("maxLength", maxLength)

  const fuse = new Fuse(records, {
    distance: maxLength, // TODO longest paragraph
    keys: [
      "text"
    ],
    includeScore: true,
  })

  const results = fuse.search(inputText)
  console.debug("results", results)
  if (results.length && results[0].score < 0.8)
    return results[0]
}

let currentParagraph
function findMatching(inputText) {
  if ((inputText.length < 10) || inputText.split(/\s+/).length <= 2) return

  const paragraphs = Array.from(document.querySelectorAll("p, h1, h2, h3, h4, h5, h6, div.question, div.answer, li"))

  if (currentParagraph) {
    const index = paragraphs.indexOf(currentParagraph)
    console.debug("find in currentParagraph", currentParagraph)
    if (findInParagraphs(paragraphs.slice(index, index+1), inputText)) {
      return currentParagraph
    }
  }

  const result = findInParagraphs(paragraphs, inputText)
  if (result) {
    console.debug("found result in all paragraphs", result.score, result.item.p.innerText)
    currentParagraph = result.item.p
    return result.item.p
  }
}

window.findMatching = findMatching
