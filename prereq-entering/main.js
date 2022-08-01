
let requirementsContent = undefined

fetch("requirements.json")
  .then((response) => {
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    return response.json();
  })
  .then((response) => {
    requirementsContent = response;
    skipUntilUndefined();
    updateText();

  })

let courseIndex = 0;

let prereqTextElem = document.getElementById("prereqText");
let courseIndexElem = document.getElementById("courseIndex");


let prereqInputElem = document.getElementById("prereqInput");
// let coreqInputElem = document.getElementById("coreqInput");
// let incomInputElem = document.getElementById("incomInput");

let prereqEntries = JSON.parse(localStorage.getItem("prereqEntries")) || {};

function skipUntilUndefined() {
    while(prereqEntries[requirementsContent[courseIndex][0]] !== undefined) {
      courseIndex ++;
    }
}

// Load the file the user has input
document.getElementById("rawFile").addEventListener("change", function() {
  let file = this.files[0];

  if (file) {
    let reader = new FileReader();
    reader.onload = (evt) => {
      prereqEntries = JSON.parse(evt.target.result);
    };

    reader.onerror = (evt) => {
      console.error("Error reading file");
    };

    reader.readAsText(file, "UTF-8");
  }
}, false);

// update the course index if the user enters a course index
document.getElementById("courseIndex").addEventListener("change", (e) => {
  let index = parseInt(e.target.value) || 0;
  courseIndexElem.value = index.toString();
  courseIndex = index;

  updateText();

})

function updateText() {
  while(requirementsContent[courseIndex][2] == null) {

    savePrereqEntry({
      prereq: {tag: "NONE"},
      when: requirementsContent[courseIndex][1],
    });
    courseIndex ++;
  }

  courseIndexElem.value = courseIndex;
  let courseCodeRegex = /\$([A-Z0-9]+)\$?/g;
  prereqTextElem.innerHTML = requirementsContent[courseIndex][2].replaceAll(courseCodeRegex, "<a onclick=\"prereqInputElem.value += \'$1\'\">$1</a>");
}

document.getElementById("skipButton").addEventListener("click", () => {
    savePrereqEntry({
      prereq: {tag: "SKIPPED", rawText: requirementsContent[courseIndex][2]},
      when: requirementsContent[courseIndex][1],
    });
  courseIndex += 1;
  courseIndexElem.value = courseIndex;
  prereqInputElem.value = "",

  clearParseError();
  updateText();
})

function onSaveNextClicked() {
  const courseInfo = requirementsContent[courseIndex];
  let parsedInput = prereqInputElem.value.trim() === "" ? {tag: "NONE"} : parsePrereq(prereqInputElem.value);

  clearParseError();
  if(parsedInput === null) {
    reportParseError(parseErrors[0]);
    return;
  }

  savePrereqEntry({
    prereq: parsedInput,
    when: courseInfo[1],
  });

  prereqInputElem.value = "",
  
  courseIndex += 1;
  skipUntilUndefined();
  courseIndexElem.value = courseIndex;
  updateText();
}

document.getElementById("downloadProgressButton").addEventListener("click", () => {
  downloadObjectAsJson(prereqEntries, "prerequisites-parsed");
});

function reportParseError(err) {
  document.getElementById("prereq-input-validation").textContent = err;
  document.getElementById("prereq-input-wrapper").classList.add("errored");
}
function clearParseError(err) {
  document.getElementById("prereq-input-wrapper").classList.remove("errored");
}
function savePrereqEntry(entry) {
  prereqEntries[requirementsContent[courseIndex][0]] = entry;
  localStorage.setItem("prereqEntries", JSON.stringify(prereqEntries));
}

// https://stackoverflow.com/questions/19721439/download-json-object-as-a-file-from-browser
function downloadObjectAsJson(exportObj, exportName){
    var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportObj));
    var downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href",     dataStr);
    downloadAnchorNode.setAttribute("download", exportName + ".json");
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

document.addEventListener("keydown", function(e) {
  if(event.key == "Enter" && 
    (document.activeElement === document.body 
      || document.activeElement === prereqInputElem)) {
    onSaveNextClicked();
    return;
  }
  if(event.ctrlKey) return;
  if(document.body === document.activeElement) {
    prereqInputElem.focus();
  } 
})


// ======= Parser ========

// While Parsed tags include:
// OR: lhs, rhs
// AND: lhs, rhs
// CO(requisite): rhs
// IN(compatibility): rhs
// COURSE: course
// COURSE_MARKED: course mark
// MULT: lhs num
//
// The following also are used:
// SKIPPED
// NONE

let parseIndex = 0;
let parseString = "";
let parseErrors = [];
function parsePrereq(inputString) {
  parseIndex = 0;
  parseString = inputString;
  parseErrors = [];
  let parseResult = parseBinary();
  if(parseResult !== null && parseIndex !== parseString.length) {
    parseErrors.push("Failed to parse entire string");
    return null
  }
  return parseResult;
}

// Rather than give | and & different or the same precedence, to reduce
// accidents, they are not allowed to exist in the same level without parens
function parseBinary() {
  let lhs = parsePrefix()
  if(lhs === null) return null;

  skipSpaces();
  let opType = '';
  let tag = ''; 
  if(parseString[parseIndex] == '|' || parseString[parseIndex] == '&') {
    opType = parseString[parseIndex];
    if(parseString[parseIndex] === '|') {tag = "OR";} else {tag = "AND";}
  }
  while(parseString[parseIndex] == opType) {
    parseIndex++;
    skipSpaces();
    let rhs = parsePrefix();
    if(rhs === null) return null;
    lhs = {lhs : lhs, tag: tag, rhs : rhs};
    skipSpaces();
  }
  if (parseString[parseIndex] == '|' || parseString[parseIndex] == '&') {
    parseErrors.push("Ambiguous '" + parseString[parseIndex] + "' at " + (parseIndex + 1) + ", please use brackets to clarify.");
    return null;
  }

  return lhs;
}


// Try and parse a prefix expression
// If there was no prefix operation, then
// we are allowed to parse multiplication syntax
function parsePrefix() {
  if(parseString[parseIndex] == '~') {
    parseIndex++;
    skipSpaces();
    let rhs = parsePrefix();
    if(rhs === null) return null;
    return {tag: "CO", rhs: rhs};
  }

  if(parseString[parseIndex] == '!') {
    parseIndex++;
    skipSpaces();
    let rhs = parsePrefix();
    if(rhs === null) return null;
    return {tag: "IN", rhs: rhs};
  }

  let expr = parsePrimary();
  skipSpaces();
  if(parseString[parseIndex] == '*') {
    parseIndex ++;
    skipSpaces();
    let times = parseNumber();
    if (times === null) return null;
    return {tag: "MULT", lhs: expr, num: times};
  }
  return expr;

}

function parsePrimary() {
  if(parseString[parseIndex] == '(') {
    parseIndex++;
    skipSpaces();
    let expr = parseBinary();
    if (expr === null) return null;
    skipSpaces();
    if(parseString[parseIndex] != ')') {
      parseErrors.push("Unmatched closing paren at index " + (parseIndex + 1));
      return null;
    }
    parseIndex++;
    return expr;
  } 

  let course = parseCourse();

  skipSpaces();
  if(parseString[parseIndex] == '>') {
    parseIndex ++;
    skipSpaces();
    let mark = parseNumber();
    if(mark === null) return null;
    return {tag: "COURSE_MARKED", course: course, mark: mark};
  }

  return {tag: "COURSE", course: course};
}

function parseNumber() {
  let numberRegex = /^[0-9]+/;
  let numberMatch = parseString.slice(parseIndex).match(numberRegex);
  if(numberMatch === null) {
    parseErrors.push("Expected number at " + parseIndex + ".");
    return null;
  }
  parseIndex += numberMatch[0].length;
  return parseInt(numberMatch[0]);
}

// Returns a course, which is one of
// ANY
// FIXED: code
// PATTERN: code
//
// where pattern says what a course code must start with
function parseCourse() {
  let identRegex = /^([a-zA-Z0-9]*)(_*)/;
  let course = parseString.slice(parseIndex).match(identRegex)
  if (course[0] === "") {
    parseErrors.push("Could not parse course. Unexpected character '" + parseString[parseIndex] + "' at " + (parseIndex + 1) + ".");
    return null;
  }

  parseIndex += course[0].length;
  if(course[1] === "") {
    return {type: "ANY"};
  }
  if(course[2] === "") {
    return {type: "FIXED", code: course[1]};
  }

  return {type: "PATTERN", code: course[1]};
  

}

function skipSpaces() {
  while(parseString[parseIndex] == ' ') parseIndex++;
}
