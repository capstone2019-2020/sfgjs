/**
 * Import the required libraries
 */
// const algebra = require('algebra.js');
const algebra = require('./rwalgebrajs/RWalgebra.js');
const math = require('mathjs');
const readline = require('readline');
const m1helper = require('./m1helper.js');
const datamodel = require('./datamodel.js');

function getEquations() {
  /* TODO: implement */
  return {};
}

/**
 *
 *
 * Returns:
 * 1. numer: numerator of transfer function - Expression Object
 * 2. denom: denominator of transfer function - Expression Object
 * 3. bode: Object that contains the bode phase and magnitude equations
 *    a) phase: STRING - equation for actual bode phase plot
 *    b) magnitude: STRING - equation for actual bode magnitude plot
 *
 * @param nodes
 * @param start
 * @param end
 * @returns {{phase, d: *, magnitude, n: *}}
 */
function computeMasons(nodes, start, end) {
  console.log('in computeMasons');
  /*
   * Step 1: Calculate numerator and denominator of transfer function separately
   */
  const allLoops = m1helper.findAllLoops(nodes);
  const nonTouchingLoops = m1helper.findNonTouching(allLoops);
  const denom = m1helper.calculateDenominator(allLoops, nonTouchingLoops);
  const numer = m1helper.calculateNumerator(start, end, nodes);

  console.log( `numer: {${numer}}`);
  console.log(`denom: {${denom}}`);
  /*
   * Step 2: Calculate the ACTUAL bode phase and magnitude equations
   *       - Loop Gain = 1 - denom ??
   *
   * Note: the phase and magnitude equations will be returned as a STRING
   * instead of an expression object as the math library does not currently
   * support functions
   */

  const bodePhase = `${numer.phase()} - ${denom.phase()}`;
  const bodeMag = `20 * log10 ( (${numer.magnitude()}) / (${denom.magnitude()}))`;

  return {n: numer, // Expression
          d: denom, // Expression
          bode: {
            phase: bodePhase, // String
            magnitude: bodeMag // String
          }
          };
}

function computeLoopGain(nodes) {
  const allLoops = m1helper.findAllLoops(nodes);
  const nonTouchingLoops = m1helper.findNonTouching(allLoops);
  const denom = m1helper.calculateDenominator(allLoops, nonTouchingLoops);

  const loopGain = denom.subtract(1);
  return { bode: {
            phase: loopGain.phase(),
            magnitude:loopGain.bodeMag()
            }
          };

}

/**
 * Print out the transfer function - need to format this ourselves since currently algebra.js only supports dividing by constant integers/fractions
 *
 * @param func -- transfer function object of the form {n: numerator, d: denominator} - each field is an algebra.Expression object
 * @param start -- start node (a string)
 * @param end -- end node (a string)
 */
function printTransferFunction(func, start, end) {
  console.log(`${end}/${start} = (${func.n.toString()}) / (${func.d.toString()})`);
}

/**
 * Retrieve user inputs:
 * - n - # of eqns
 * - List of eqns
 * - Start node
 * - End node
 * Note: Assumes that the user will enter valid values
 */
function getUserInput() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  let n = 0;
  let equations = [];
  let startNode = '';
  let endNode = '';

  // Get the user inputs
  rl.question('Please type in the number of eqns: ', (ans) => {
    n = parseInt(ans);
    rl.on('line', (input) => {
      equations.push(algebra.parse(input));

      if (equations.length === n) {
        rl.question('Please type in start node: ', (ans) => {
          startNode = ans;
          rl.question('Please type in end node: ', (end) => {
            endNode = end;
            rl.close();
          });
        });
      }
    });
  });



  /*
   * For testing purposes, print out the variable values
   * Note: Once all of the tasks are completed, will have to add the data processing and function calls here
   */
  rl.on('close', () => {
    console.log('------------------------------------');
    console.log(`RETRIEVED USER INPUTS: `);
    console.log(`n: ${n} `);
    console.log(`equations: `);
    equations.forEach((eq) => console.log(eq.toString()));
    console.log(`start node: ${startNode}`);
    console.log(`end node: ${endNode}`);
    console.log('------------------------------------');

    var nodes = computeSFG(equations);
    outputSFG(nodes);
    var transferfunc = computeMasons(nodes, startNode, endNode);
    printTransferFunction(transferfunc, startNode, endNode);
  });
}

// Create a dynamic array and input each node
function computeSFG (params) {
  let nodes = [], parsed = [];
  let termsoflhs = [];
  let termsofrhs = [];
  let dpiLocation = [], haveBothRealAndImag = [], duplicateLocation = [];
  let vNodeNotFound = 0;
  let needToSearchRelation = false, dpiFound = false;

  for (let i = 0; i < params.length; i++) {
    parsed.push(algebra.parse(params[i]));
  }

  for (let i = 0; i < parsed.length; i++) {
    let counter = 0;
    //Access the eqns and split by lhs and rhs
    if (!parsed[i].lhs.real.terms.toString().includes('DPI')) {
      if (parsed[i].lhs.real.terms.length !== 0) {
        // console.log(`Equation LHS: ${termsoflhs.length}`);
        // console.log(parsed[i].lhs.real.terms.toString());
        termsoflhs.push(parsed[i].lhs.real.terms);
      }

      if (parsed[i].lhs.imag.terms.length !== 0) {
        // console.log(`Equation LHS: ${termsoflhs.length}`);
        // console.log(parsed[i].lhs.imag.terms.toString());
        termsoflhs.push(parsed[i].lhs.imag.terms);
      }

      if (parsed[i].rhs.imag.terms.length !== 0) {
        // console.log(`Equation RHS: ${termsofrhs.length}`);
        // console.log(parsed[i].rhs.imag.terms.toString());
        termsofrhs.push(parsed[i].rhs.imag.terms);
        counter++;
      }

      if (parsed[i].rhs.real.terms.length !== 0) {
        // console.log(`Equation RHS: ${termsofrhs.length}`);
        // console.log(parsed[i].rhs.real.terms.toString());
        termsofrhs.push(parsed[i].rhs.real.terms);
        counter++;
      }

      if (counter === 2) {
        // console.log("COUNTING RIGHT!!!!!");
        // console.log(`THE RHS INDX NUMBER ${termsofrhs.length-1}`);
        haveBothRealAndImag.push(termsofrhs.length-1);
      }

      // Right hand side has no terms
      if (parsed[i].rhs.real.terms.length === 0 && parsed[i].rhs.imag.terms.length === 0) {
        termsofrhs.push(null);
        // console.log(`Equation RHS: ${termsofrhs.length}`);
        // console.log("rhs = NULL");
      }
    } else {
      dpiLocation.push(i);
    }
  }

  // To store into the nodes, go through the termsoflhs list array
  for (let i = 0; i < termsoflhs.length; i++) {
    // console.log("------------------------------------------")
    // console.log(`LHS Term is:  ${termsoflhs[i].toString()}`);
    let duplicate = false;
    // Do not create a node for those that have DPI as term on the lhs
    // Save the placement of the DPI equation
    // console.log(`New Node id is ${termsoflhs[i].toString()}`);
    // Check for duplicates
    for (let m = 0; m < nodes.length; m++) {
      if (termsoflhs[i].toString() === nodes[m].id.toString()) {
        duplicate = true;
        duplicateLocation.push(nodes[m].id.toString());
      }
    }

    if (duplicate == false) {
      newNode = new datamodel.Node(termsoflhs[i].toString(), null);
    }

    // Find the Node corresponding to the termsoflhs to determine the outoging edges
    // Divide the rhs into coefficients and variables and store into the edges
    for (let j = 0; j < termsofrhs.length; j++) {
      if (termsofrhs[j] !== null && dpiFound == false && duplicate == false) {
        var tempTermOfrhs = termsofrhs[j];
        // console.log(tempTermOfrhs.length);

        // The variable is found in the rhs of the equation then it must be an outgoing node
        // More than one term in the rhs of the equation
        for (k = 0; k < tempTermOfrhs.length; k++) {
          if (tempTermOfrhs[k].toString().search(termsoflhs[i].toString()) != -1) {
            // console.log(tempTermOfrhs[k].toString());
            let wFound = false;
            var weight = tempTermOfrhs[k].coefficient;
            var startNode = tempTermOfrhs[k].variables;
            // console.log(weight.toString());

            // Means there is an alphabet as part of the coefficient
            if (startNode.length !== 1) {
              check = startNode[startNode.length-1].toString();
              if (check.search("w") !== -1) {
                check = startNode[startNode.length-2].toString();
                wFound = true;
              }
              var toBeWeight = startNode.toString().split(termsoflhs[i].toString());

              // console.log("TO BE WEIGHT = " + toBeWeight[0]);
              if (weight === 1) {
                weight = toBeWeight[0];
              } else if (weight === -1) {
                weight = "-"+toBeWeight[0];
              } else {
                if (toBeWeight[0] !== "") {
                  weight = weight.toString() + "*" + toBeWeight[0];
                }
              }

              // Get rid of the commas in the weight string
              if (weight.toString().search(',') !== -1) {
                weight = weight.toString().replace(/,/g, '');
              }
              if (wFound === true) {
                weight += "*w";
              }
            } else {
              check = startNode.toString();
            }

            // Coefficient includes a fraction
            if (math.abs(Number(tempTermOfrhs[k].fraction.numer)) !== 1 || math.abs(Number(tempTermOfrhs[k].fraction.denom)) !== 1) {
              if (math.abs(Number(tempTermOfrhs[k].fraction.numer)) == 1 && math.abs(Number(tempTermOfrhs[k].coefficient)) !== 1) {
                weight = weight + " / (" + tempTermOfrhs[k].fraction.denom.toString() + ")";
              } else if (math.abs(Number(tempTermOfrhs[k].fraction.numer)) == 1 && math.abs(Number(tempTermOfrhs[k].coefficient)) == 1) {
                weight = weight + " / (" + tempTermOfrhs[k].fraction.denom.toString() + ")";
              } else {
                weight += "*(" + tempTermOfrhs[k].fraction.numer.toString() + ") / (" + tempTermOfrhs[k].fraction.denom.toString() + ")";
              }
            }

            // Imaginary number case
            if (tempTermOfrhs[k].imag === true) {
              weight = weight + "*j";
            }

            if (check === termsoflhs[i].toString()) {
              let currEdgeID, sameEdgeID = false, edgesLength;
              let endNode, foundNewEndNode = false;

              for (let l = 0; l < haveBothRealAndImag.length; l++) {
                // console.log(`j is rhs num currently = ${j}, l = ${haveBothRealAndImag[l]}`);
                if (haveBothRealAndImag[l] === j) {
                  // console.log("ENTERED THERE");
                  endNode = termsoflhs[j-1];
                  foundNewEndNode = true;
                  break;
                }
              }

              if (foundNewEndNode == false) {
                // console.log("ENTERED HERE");
                endNode = termsoflhs[j];
              }

              // For special cases like netlist_ann_vccs.txt
              currEdgeID = termsoflhs[i].toString()+endNode.toString();
              newNode.outgoingEdges.forEach((nn, i) => {
                if (nn.id.toString() == currEdgeID) {
                  sameEdgeID = true;
                  edgesLength = i;
                }
              });

              newNode.outgoingEdges.push(new datamodel.Edge(weight.toString(), termsoflhs[i].toString(), endNode.toString()));
              // Give unique id to the Edge
              if (sameEdgeID == true) {
                newNode.outgoingEdges[edgesLength+1].id = currEdgeID+"_"+(edgesLength+1);
              }
            }
          }
        }
      }
    }

    if (dpiFound == false && duplicate == false) {
      nodes.push(newNode);
    }
    dpiFound = false;
  }

  // console.log("-----------------------------------");
  // nodes.forEach(eqns => console.log(eqns.id.toString()));
  // Corner case: the Node only has outgoing edges
  nodesNum = nodes.length;
  for (let i = 0; i < termsofrhs.length; i++) {
    if (termsofrhs[i] !== null) {
      var tempTerm = termsofrhs[i];
      // console.log("RHS equation being looked at: " + tempTerm.toString());

      if (tempTerm !== null) {
        for (let j = 0; j < tempTerm.length; j++) {
          vNodeNotFound = 0;

          for (let numOfNodes = 0; numOfNodes < nodes.length; numOfNodes++) {
            if (tempTerm[j].toString().search(nodes[numOfNodes].id) === -1) {
              vNodeNotFound += 1;
            }
          }

          // Create only the missing node
          if (vNodeNotFound === nodes.length) {
            // console.log(vNodeNotFound);
            // console.log(nodes.length);
            // console.log("ENTERED THE IF STATMENT");
            var tempVariable = tempTerm[j].variables;
            var value = null;
            needToSearchRelation = true;

            // Means there is an alphabet as part of the coefficient
            if (tempVariable.length != 1 && tempVariable.length != 0) {
              startNode = tempVariable[tempVariable.length-1];
              // console.log(typeof(startNode));
              // console.log(startNode);
              if (startNode.toString().search("w") != -1) {
                startNode = tempVariable[tempVariable.length-2];
              }
            }
            else if (tempVariable.length === 1) {
              startNode = tempVariable;
            }

            // console.log(`NEW NODE IS: ${startNode}`);
            if (startNode.toString().search("w") == -1 && startNode.toString().search("DPI") == -1) {
              // console.log("ENTERED TO ADD IN THE NODE");
              // console.log(`NEW NODE IS: ${startNode}`);
              newNode = new datamodel.Node(startNode.toString(), value);
              nodes.push(newNode);

              if (termsoflhs.length < termsofrhs.length) {
                // console.log(`INPUTTING INTO LHS ARRAY: ${startNode.toString()}`);
                termsoflhs.push(startNode.toString());
              }
            }
          }
        }
      }
    }
  }

  // Searching through the rhs of the eqns again to ensure the new nodes are also connected
  // nodes.forEach(eqns => console.log(eqns.id.toString()));
  if (needToSearchRelation === true) {
    for (let searchNeeded = nodesNum; searchNeeded < nodes.length; searchNeeded++) {
      for (let i = 0; i < termsofrhs.length; i++) {
        var tempTerm = termsofrhs[i];

        if (tempTerm !== null) {
          for (let j = 0; j < tempTerm.length; j++) {
            if (tempTerm[j].toString().search(nodes[searchNeeded].id) != -1) {
              let wFound = false;
              var weight = tempTerm[j].coefficient;
              var tempVariable = tempTerm[j].variables;

              if (tempVariable.length != 1 && tempVariable.length != 0) {
                // console.log("ENTERED THE IF STATEMENT");
                var temp = tempVariable[tempVariable.length - 1].toString(), toBeWeight;
                if (temp.search("w") !== -1) {
                  temp = tempVariable[tempVariable.length - 2].toString();
                  wFound = true;
                }
                toBeWeight = tempVariable.toString().split(temp);

                if (weight === 1) {
                  weight = toBeWeight[0];
                } else if (weight === -1) {
                  weight = "-"+toBeWeight[0];
                } else {
                  if (toBeWeight[0] !== "") {
                    weight = weight.toString() + "*" + toBeWeight[0];
                  }
                }

                // Get rid of the commas in the weight string
                if (weight.toString().search(',') !== -1) {
                  weight = weight.toString().replace(/,/g, '');
                }
                if (wFound === true) {
                  weight += "*w";
                }
              } else {
                temp = tempVariable.toString();
              }

              // Coefficient includes a fraction
              if (math.abs(Number(tempTerm[j].fraction.numer)) !== 1 || math.abs(Number(tempTerm[j].fraction.denom)) !== 1) {
                if (math.abs(Number(tempTerm[j].fraction.numer)) == 1 && math.abs(Number(tempTerm[j].coefficient)) !== 1) {
                  weight = weight + " / (" + tempTerm[j].fraction.denom.toString() + ")";
                } else if (math.abs(Number(tempTerm[j].fraction.numer)) == 1 && math.abs(Number(tempTerm[j].coefficient)) == 1) {
                  weight = weight + " / (" + tempTerm[j].fraction.denom.toString() + ")";
                } else {
                  weight += "*(" + tempTerm[j].fraction.numer.toString() + ") / (" + tempTerm[j].fraction.denom.toString() + ")";
                }
              }

              if (tempTerm[j].imag === true) {
                weight = weight + "*j";
              }

              if (temp === nodes[searchNeeded].id) {
                // console.log("NEW NODE TO BE ADDED");
                // console.log(`Start Node: ${nodes[searchNeeded].id.toString()}`);
                // console.log(`End Node: ${termsoflhs[i].toString()}`);
                // console.log(weight.toString());
                nodes[searchNeeded].outgoingEdges.push(new datamodel.Edge (weight.toString(), nodes[searchNeeded].id, termsoflhs[i].toString()));
              }
            }
          }
        }
      }
    }
  }

  // Deal with the constants in the rhs of the equation
  for (let i = 0; i < parsed.length; i++) {
    // console.log("---------------------------------------------");
    // console.log(parsed[i].toString());
    let duplicate = false, indx;
    for (let j = 0; j < duplicateLocation.length; j++) {
      if (duplicateLocation[j] === parsed[i].lhs.real.terms.toString()) {
        // console.log("FOUND~~~~~~!!!");
        indx = j;
        duplicate = true;
      }
    }

    // Constant exist in the equation - y1&i as the id for imaginary constants with terms
    if (parsed[i].rhs.imag.terms.length !== 0 || parsed[i].rhs.real.terms.length !== 0){
      // console.log("ENTERED FIRST");
      if (parsed[i].rhs.imag.constant !== null) {
        if (parsed[i].rhs.imag.constant.toString() !== "0") {
          var id = "y1"+i;
          var value = parsed[i].rhs.imag.constant+"j";
          newNode = new datamodel.Node(id, value);
          newNode.outgoingEdges.push(new datamodel.Edge("1", id, termsoflhs[i].toString()));
          nodes.push(newNode);
        }
      }

      if (parsed[i].rhs.real.constant !== null) {
        if (parsed[i].rhs.real.constant.toString() !== "0") {
          var id = "y2"+i;
          newNode = new datamodel.Node(id, parsed[i].rhs.real.constant.toString());
          newNode.outgoingEdges.push(new datamodel.Edge("1", id, termsoflhs[i].toString()));
          nodes.push(newNode);
        }
      }
    }

    // No terms exists in the rhs then the value must be given to existing node
    // example v1 = 8 or v1 = 5j
    else if (parsed[i].rhs.imag.terms.length === 0 && parsed[i].rhs.real.terms.length === 0
        && duplicate == false) {
      if (!parsed[i].lhs.real.terms.toString().includes('DPI')) {
        // console.log("ENTERED SECOND");
        for (let j = 0; j < nodes.length; j++) {
          if (parsed[i].lhs.real.terms.toString() === nodes[j].id.toString()) {
            // console.log("---------------------------------------------");
            // console.log(`Node being looked at: ${nodes[j].id.toString()}`);
            // console.log(`Value updated to: ${parsed[i].rhs.real.constant.toString()}`);
            nodes[j].value = parsed[i].rhs.real.constant.toString();
          } else if (parsed[i].lhs.imag.terms.toString() === nodes[j].id.toString()) {
            // console.log("---------------------------------------------");
            // console.log(`Node being looked at: ${nodes[j].id.toString()}`);
            // console.log(`Value updated to: ${parsed[i].rhs.imag.constant.toString()}`);
            nodes[j].value = parsed[i].rhs.imag.constant.toString();
          }
        }
      }
    }

    else if (parsed[i].rhs.imag.terms.length === 0 && parsed[i].rhs.real.terms.length === 0) {
      // console.log("ENTERED THIRD");
      for (let j = 0; j < nodes.length; j++) {
        // Find the already existing node and then include another Edge
        if (nodes[j].id.toString() === duplicateLocation[indx]) {
          // console.log("NODE FOUND IN THE NODES LIST");
          if (parsed[i].rhs.imag.constant !== null) {
            if (parsed[i].rhs.imag.constant.toString() !== "0") {
              var id = "y1"+i;
              var value = parsed[i].rhs.imag.constant+"j";
              newNode = new datamodel.Node(id, value);
              newNode.outgoingEdges.push(new datamodel.Edge("1", id, nodes[j].id.toString()));
              nodes.push(newNode);
            }
          }

          if (parsed[i].rhs.real.constant !== null) {
            if (parsed[i].rhs.real.constant.toString() !== "0") {
              var id = "y2"+i;
              newNode = new datamodel.Node(id, parsed[i].rhs.real.constant.toString());
              newNode.outgoingEdges.push(new datamodel.Edge("1", id, nodes[j].id.toString()));
              nodes.push(newNode);
            }
          }
        }
      }
    }
  }

  // Replace the DPI value in the weight
  for (let i = 0; i < dpiLocation.length; i++) {
    let nodeID = params[dpiLocation[i]];
    // console.log(`Value to be added is : ${nodeID}`);

    // Split it by =
    let DPIEqn = nodeID.split("=");
    let value = DPIEqn[1];
    let lhsCompared = DPIEqn[0].trim();

    for(let j = 0; j < nodes.length; j++) {
      nodes[j].outgoingEdges.forEach(n => {
        if (n.weight.toString() === lhsCompared) {
          // console.log(`LHS IS: ${lhsCompared}, \n Value is: ${value}`);
          n.weight = value;
        }
      });
    }
  }

  return nodes;
};

// Output into the console
function outputSFG (sfgnodes) {
    console.log(`SFG: `);

    for (let i = 0; i < sfgnodes.length; i++) {
        console.log('------------------------------------');
        console.log(`Node: ${sfgnodes[i].id} `);
        console.log(`The value stored in the node is ${sfgnodes[i].value}`)
        console.log('------------------------------------');
        console.log(`Connections: `);
        sfgnodes[i].outgoingEdges.forEach((eq) => console.log(`Edge id ${eq.id}: connected node = ${eq.endNode}, weight = ${eq.weight}`));
    }
};

// // getUserInput();
// (function main(){
//   // let testEquations = [
//   //   "V_n1 = 8",
//   //   "V_n2 = DPI_n2 * ISC_n2",
//   //   "DPI_n2 = 9",
//   //   "ISC_n2 = V_n1/R1 + V_n3/R3"];
//   // let testEquations = [
//   //   "V_n1 = 8",
//   //   "V_n2 = DPI_n2 * ISC_n2",
//   //   "DPI_n2 = 10",
//   //   "ISC_n2 = V_n1/R1 + V_n3/R3",
//   //   "V_n3 = DPI_n3 * ISC_n3",
//   //   "DPI_n3 = 3000",
//   //   "ISC_n3 = V_n2/3000 + 0.001"
//   // ]
//   // let testEquations = [
//   //   "V_n1 = 5",
//   //   "V_n2 = DPI_n2 * ISC_n2",
//   //   "DPI_n2 = 40",
//   //   "ISC_n2 = V_n1/R1"
//   // ];
//   // let testEquations = [
//   //   "Vn1 = 9",
//   //   "Vn2 = DPI_n2 * ISC_n2",
//   //   "DPI_n2 = 10*jw",
//   //   "ISC_n2 = Vn1/R1 + 10*Vn0*jw"
//   // ];
//   // let testEquations = [
//   //   "V_n1 = 8*V_n2",
//   //   "V_n2 = DPI_n2 * ISC_n2",
//   //   "DPI_n2 = 9",
//   //   "ISC_n2 = V_n1/R1 + V_n3/R3",
//   //   "V_n3 = (-2)"
//   // ];
//   // let testEquations = [
//   //   "V_n1 = 8",
//   //   "V_n2 = DPI_n2 * ISC_n2",
//   //   "DPI_n2 = 20",
//   //   "ISC_n2 = V_n1/1000 + V_n3/3000",
//   //   "V_n3 = DPI_n3 * ISC_n3",
//   //   "DPI_n3 = 3000",
//   //   "ISC_n3 = V_n2/3000",
//   //   "ISC_n3 = 3*V_n2"
//   // ];
//   // let testEquations = [
//   //   "V_n1 = 0.1",
//   //   "V_n2 = DPI_n2*ISC_n2",
//   //   "DPI_n2 = 833.3333333333333",
//   //   "ISC_n2 = 0.001*V_n1",
//   //   "V_n3 = 100*V_n2",
//   //   "V_n4 = DPI_n4*ISC_n4",
//   //   "DPI_n4 = 50",
//   //   "ISC_n4 = 0.01*V_n3"
//   // ];
//   // let testEquations = [
//   //   "V_n1 = 20",
//   //   "V_n2 = DPI_n2 * ISC_n2",
//   //   "DPI_n2 = 15",
//   //   "ISC_n2 = V_n1/R1 + V_n3/R3",
//   //   "V_n3 = DPI_n3 * ISC_n3",
//   //   "DPI_n3 = 10",
//   //   "ISC_n3 = V_n2/R3 + V_n4/R5",
//   //   "V_n4 = 8*(V_n2 - V_n3)"
//   // ]
//   let testEquations = [
//     "V_n1 = 8",
//     "V_n3 = DPI_n3*ISC_n3",
//     "DPI_n3 = 3000",
//     "ISC_n3 = 0.0003333333333333333*V_n2",
//     "ISC_n3 = 3*V_n2",
//     "V_n2 = DPI_n2*ISC_n2",
//     "DPI_n2 = 545.4545454545455",
//     "ISC_n2 = 0.001*V_n1 + 0.0003333333333333333*V_n3"
//   ];
//   // let testEquations = [
//   //   "V_n7 = (-10000)*V_n1 + 10000",
//   //   "V_n3 = (-10000)*V_n1 + 10000",
//   //   "V_n4 = DPI_n4*ISC_n4",
//   //   "DPI_n4 = ((-8e-7)) / (8e-10*w*j + (-8e-10)*w*j + 6.399999999999999e-13*w^2 + 0.000001)*w*j + (0.001) / (8e-10*w*j + (-8e-10)*w*j + 6.399999999999999e-13*w^2 + 0.000001)",
//   //   "ISC_n4 = 0.001*V_n3",
//   //   "V_n5 = V_n4",
//   //   "V_n2 = V_n6",
//   //   "V_n6 = DPI_n6*ISC_n6",
//   //   "DPI_n6 = ((-4.000000000000001e-10)) / (4.000000000000001e-13*w*j + (-4.000000000000001e-13)*w*j + 1.6000000000000009e-19*w^2 + 0.000001)*w*j + (0.001) / (4.000000000000001e-13*w*j + (-4.000000000000001e-13)*w*j + 1.6000000000000009e-19*w^2 + 0.000001)",
//   //   "ISC_n6 = 0.001*V_n5",
//   //   "V_n1 = DPI_n1*ISC_n1",
//   //   "DPI_n1 = 800",
//   //   "ISC_n1 = 0.00025*V_n2"
//   // ];
//   // let testEquations = [
//   //   "V_n1 = 8",
//   //   "V_n3 = DPI_n3*ISC_n3",
//   //   "DPI_n3 = 3000",
//   //   "ISC_n3 = 0.0003333333333333333*V_n2",
//   //   "ISC_n3 = 0.001",
//   //   "V_n2 = DPI_n2*ISC_n2",
//   //   "DPI_n2 = 545.4545454545455",
//   //   "ISC_n2 = 0.001*V_n1 + 0.0003333333333333333*V_n"
//   // ];
//
//   let sfgnodes = computeSFG(testEquations);
//   outputSFG(sfgnodes);
// })();

/**
 * Export functions as part of m1 module
 */
module.exports = {
  outputSFG, computeSFG, computeMasons, getEquations, getUserInput, computeLoopGain
};
