
let requisitesData = undefined;


fetch("requisites-data.json")
  .then((response) => {
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    return response.json();
  })
  .then((response) => {
    requisitesData = response;
  })

const completedInputElem = document.getElementById("completedInput");
const concurrentInputElem = document.getElementById("concurrentInput");
const toCheckInputElem = document.getElementById("toCheckInput");
const errorContainerElem = document.getElementById("errContainer");

let errors = [];

let completedCourses = [];
let concurrentCourses = [];
let tempCompleted  = [];
let tempConcurrent = [];

function checkCourse() {
  if(requisitesData === undefined) {
    clearErrors();
    addError("Prerequisites data not loaded.")
    return;
  }

  completedCourses = completedInputElem.value.split(/[ \t\n,]+/).filter(x => x.trim() !== "");
  concurrentCourses = concurrentInputElem.value.split(/[ \t\n,]+/).filter(x => x.trim() !== "");
  const toCheck = toCheckInput.value.trim();

  tempCompleted = [...completedCourses];
  tempConcurrent = [...concurrentCourses];

  clearErrors();
  if(requisitesData[toCheck] === undefined) {
    addError("Course information is not loaded"); 
    return;
  }
  let expression = requisitesData[toCheck].prereq;
  let simpleExpr = simplifyPass(expression);
  if(errors.length !== 0) return;

  // addError(pprint(simpleExpr))

  let success = checkMeets(simpleExpr, completedCourses, concurrentCourses);
  if(success.errors === undefined) {
    addError("Requirements met!!")
  } else {
    addError("Did not meet requirements: " + pprint(simpleExpr));
    for(let e in success.errors) {
      addError(success.errors[e]);
    }
  }

}

// This function returns either the object {completed, concurrent} on success
// or {errors} on failure.
function checkMeets(expr, completed, concurrent) {
  switch(expr.tag) {
    case "SKIPPED":
      if(expr.rawText) {
        return {errors: ["Please manually check that: " + expr.rawText]}
      } else {
        return {errors: ["Could not check course requirements automatically."]}
      }
      break;
    case "NONE":
      return {completed, concurrent};
    case "OR":{
      let lhsResult = checkMeets(expr.lhs, completed, concurrent) 
      if(lhsResult.errors !== undefined) {
        let rhsResult = checkMeets(expr.rhs, completed, concurrent)
        if(rhsResult.errors !== undefined) {
          return lhsResult;
        }
        return rhsResult;
      }

      return lhsResult;
    }
    case "AND": {
      let lhsResult = checkMeets(expr.lhs, completed, concurrent) 
      let rhsResult = checkMeets(expr.rhs, completed, concurrent)
      if(lhsResult.errors === undefined) {
        return rhsResult;
      }
      if(rhsResult.errors === undefined) {
        return lhsResult;
      }
      return {errors: lhsResult.errors.concat(rhsResult.errors)};
      }
      
    case "CO":
      let courseIndex = findCourse(concurrent, expr.rhs.course);
      if(courseIndex === -1) 
        return {errors: ["Not taking " + pprint(expr.rhs) + " concurrently."]}
      
      return {completed, concurrent: concurrent.filter((_, i) => i !== courseIndex)};
    case "IN":
      if(expr.rhs.tag === "CO") {
        let courseIndex = findCourse(concurrentCourses, expr.rhs.rhs.course);
        if(courseIndex !== -1) 
          return {errors: ["Are taking incompatible course " + pprint(expr.rhs.rhs)]};
        
        return {concurrent, completed};

      } else {

        let courseIndex = findCourse(concurrentCourses, expr.rhs.course);
        if(courseIndex !== -1) 
          return {errors: ["Cannot take incompatible course " + pprint(expr.rhs) + "."]};

        courseIndex = findCourse(completedCourses, expr.rhs.course);
        if(courseIndex !== -1)
          return {errors: ["Have already taken " + pprint(expr.rhs)]};

        return {concurrent, completed};
      }
      break;
    case "COURSE":
    case "COURSE_MARKED":{
      let courseIndex = findCourse(completed, expr.course);
      if(courseIndex === -1) 
        return {errors: ["Have not taken " + pprint(expr) + "."]}
      
      return {concurrent, completed: completed.filter((_, i) => i !== courseIndex)};
    }

    case "MULT":
      let meetsAll = true;
      for(let i = 0; i < expr.num; i++) {
        meetsAll = meetsAll && checkMeets(expr.lhs);
      }
      return meetsAll;
  }
}

function findCourse(courseList, course) {
  console.log("Searching for " + course.code + " in " + courseList);
  if(course.type === "ANY") {
    if(courseList.length > 0) return 0;
    else return -1;
  }
  if(course.type === "FIXED") {
    return courseList.indexOf(course.code);
  }
  if(course.type === "PATTERN") {
    for(let i = 0; i < courseList.length; i ++) {
      if(courseList[i].startsWith(course)) {
        return i;
      }
    }
    return -1;
  }
}

function pprint(expr) {
  switch(expr.tag) {
    case "SKIPPED":
      return "skipped: 'rawText'"
    case "NONE":
      return "none";
    case "OR":
      return "(" + pprint(expr.lhs) + " | " + pprint(expr.rhs) + ")"
    case "AND":
      return "(" + pprint(expr.lhs) + " & " + pprint(expr.rhs) + ")"
    case "CO":
      return "~" + pprint(expr.rhs)
    case "IN":
      return "!" + pprint(expr.rhs)
    case "COURSE":
      if(expr.course.tag === "ANY") return "_"
      return expr.course.code;
    case "COURSE_MARKED":
      return expr.course.code + " > " + expr.mark
    case "MULT":
      return pprint(expr.lhs) + " * " + expr.num
  }
}
function addError(err) {
  errors.push(err);
  let div = document.createElement('div');
  div.classList.add("flash");
  div.classList.add("flash-error");
  div.textContent = err;
  errorContainerElem.appendChild(div);
}

function clearErrors() {
  errors = [];
  while(errorContainerElem.firstChild) {
    errorContainerElem.removeChild(errorContainerElem.firstChild);
  }
}



// There are a few rules that make statically checking stuff waaaaayy
// easier if impleemented (or at least i hope they make it easier,
// otherwise this optimising will be useless)
//
// Transformations:
// - !(A | B)    =>   !A & !B      DeMorgan's laws let the ! operator only
// - !(A & B)    =>   !A | !B      exist over courses, which lets us check
// - !!A         =>   A            they dont have marks attatched
// - (A | B) & C =>   (A & C) | (B & C)
function simplifyPass(expr) {
  switch(expr.tag) {
    case "OR":
      return {
        tag: "OR",
        lhs: simplifyPass(expr.lhs),
        rhs: simplifyPass(expr.rhs),
      };
    case "AND":
      if(expr.lhs.tag === "OR") {
        return {
          tag: "OR",
          lhs: simplifyPass({
            tag: "AND",
            lhs: expr.lhs.lhs,
            rhs: expr.rhs
          }),
          rhs: simplifyPass({
            tag: "AND",
            lhs: expr.lhs.rhs,
            rhs: expr.rhs
          })
        }
      } 
      return {
        tag: "AND",
        lhs: simplifyPass(expr.lhs),
        rhs: simplifyPass(expr.rhs),
      };
    case "IN":
      if(expr.rhs.tag === "OR") {
        return {
          tag: "AND",
          lhs: simplifyPass({
            tag: "NOT",
            rhs: expr.rhs.lhs,
          }),
          rhs: simplifyPass({
            tag: "NOT",
            rhs: expr.rhs.rhs,
          }),
        }
      } else if(expr.rhs.tag === "AND") {
        return {
          tag: "OR",
          lhs: simplifyPass({
            tag: "NOT",
            rhs: expr.rhs.lhs,
          }),
          rhs: simplifyPass({
            tag: "NOT",
            rhs: expr.rhs.rhs,
          }),
        }
      } else if (expr.rhs.tag === "CO" && expr.rhs.rhs.tag === "COURSE") {
        return expr;
      } else if (expr.rhs.tag === "COURSE") {
        return expr;
      }

      addError("Internal Error: IN cannot operate on non-course.")
      return expr;
      break;
    case "SKIPPED":
      return expr;
    case "NONE":
      return expr;
    case "CO":
      if (expr.rhs.tag === "COURSE") {
        return expr;
      }
      addError("Internal Error: CO cannot operate on non-course.")
      return expr;
    case "COURSE":
      return expr;
    case "COURSE_MARKED":
      return expr;
    case "MULT":
      return {
        tag: "MULT",
        lhs: simplifyPass(expr.lhs),
        num: expr.num,
      };
      break;
  }
}

