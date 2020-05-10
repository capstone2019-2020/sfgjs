const algebra = require('./rwalgebra/RWalgebra.js');
const Expression = algebra.Expression;

const DEBUG = 0;

/**
 * Wrapper function that performs DFS to find all the loops in the graph.
 * High level overview:
 * 1. Loop through all of the nodes
 * 2. For each node, do DFS to find all simple cycles that start and end with that node
 *
 * @param nodes
 * @returns List all of the cycles (list of a list - each element contains a list of edges indicating a cycle)
 */
function findAllLoops(nodes) {
  let visited = [];
  let stack = [];
  let cycles = [];

  if (DEBUG) {
    console.log(JSON.stringify(nodes));
  }
  nodes.forEach((node) => {
    dfsFindLoops(nodes, node, node.id, visited, stack, cycles);
  });

  // For debugging purposes - print out the found loops if DEBUG enabled
  if (DEBUG) {
    console.log(`----------------------------------`);
    console.log(`Found ${cycles.length} loops:`);
    console.log(`----------------------------------`);
    cycles.forEach((e) => printEdges(e));
  }

  return cycles;
}

/**
 * Performs DFS to find all the simple cycles that start and end with the startId
 *
 * @param nodes
 * @param curr - current node that we are traversing
 * @param startId - root node used to determine a cycle
 * @param visited - List of the nodes that have already been visited
 * @param stack - Contains a list of edges that the algorithm has currently traversed
 * @param cycles
 */
function dfsFindLoops(nodes, curr, startId, visited, stack, cycles) {
  visited.push(curr.id);
  let v, edge, i;
  let edges = curr.outgoingEdges;

  for (i = 0; i < edges.length; i++) {
    edge = edges[i];
    v = nodes.find(x => x.id === edge.endNode);

    if (!v)
      continue;

    // Found a cycle
    if (v.id === startId) {
      stack.push(edge);
      let copy = [...stack];
      cycles.push(copy);
      stack.pop();
      continue;
    }

    // No cycle found, need to keep traversing graph
    if (!visited.includes(v.id)){
      stack.push(edge);
      dfsFindLoops(nodes, v, startId, visited, stack, cycles);
    }
  }

  if (curr.id !== startId) {
    stack.pop();
    visited.pop();
  }
}

/**
 * Helper function for debugging.
 * Prints out the path indicated by the edges parameter
 *
 * @param edges
 */
function printEdges(edges) {
  let str = '';
  edges.forEach((e, i) => {
    if (i === 0)
      str += `${e.startNode}`;
    str +=` -> ${e.endNode}`;
  });
  console.log(str);
}

/**
 * Wrapper function for calcaulting numerator of Mason's rule
 * 
 * @param start - start node id
 * @param end  - end node id
 * @param nodes - entire SFG represented as a list of node objects
 */
function calculateNumerator(start, end , nodes){
  var start = nodes.find(x => x.id === start);
  var end = nodes.find(x => x.id === end);
  var curr_path = [];
  // The following three arrays are mapped using index
  var paths = [];
  var forwardLoopgains = [];
  var delta_k = [];
  let numer = new Expression(0);

  // Step 1 - handle forward paths (this is P_k in the equation)
  findForwardPaths(start, end, nodes, paths, curr_path); // paths variable is now filled in 
  var forwardLoopgains = getForwardPathsLoopgains(paths);

  // Step 2 - handle loops that do not touch kth forward path (this is delta_k)
  paths.forEach(p => { 
    const subgraph = subtractNodes(nodes, p);
    const allLoops = findAllLoops(subgraph);
    const nonTouchingLoops = findNonTouching(allLoops);
    const d_k = calculateDenominator(allLoops, nonTouchingLoops);
    delta_k.push(d_k);

  });

  // Find the sum of P_k * delta_k
  if (forwardLoopgains. length == delta_k.length){  // Sanity check
    for (let i=0; i<forwardLoopgains.length; i++){
        let ex = forwardLoopgains[i];
        ex = ex.multiply(delta_k[i]);
        numer = numer.add(ex);
    }
    return numer;
  }
  else{
    console.log("The number of P-K and delta_k do no match")
    return undefined
  }
}

/**
 * Find all available forward paths from start to end node 
 * and put that information in paths input parameter as a 2D array
 * using depth first search
 * 
 * @param start
 * @param end
 * @param nodes
 * @param paths - a list of valid forward paths (a.k.a 2D array of nodes)
 * @param currPath - the path DFS is currently pursuing
 */
function findForwardPaths(start, end, nodes, paths, currPath){
  // The destination node is reached
  if (start === end){
    currPath.push(start);
    paths.push(currPath);
    return;
  }
  // Stop if loop is detected or there is no outgoing edges
  else if (currPath.includes(start) || (start.outgoingEdges).length < 1){
    return; 
  }
  else{
    currPath.push(start);
  }

  for (let i=0; i < start.outgoingEdges.length; i++){
    nextNodeId = start.outgoingEdges[i].endNode;
    nextNode = nodes.find(x => x.id === nextNodeId);

    currPathCopy = [];

    // In js, an array passed in as a parameter is passed by reference
    // Manually make a copy of currPath to avoid mixing up different forward paths
    currPath.forEach(e => {
      currPathCopy.push(e);
    });

    findForwardPaths(nextNode, end, nodes, paths, currPathCopy);
  }
}

/**
 * Given paths, calculate the forward loop gains
 * 
 * @param paths - a list of forward paths
 * @returns a list of forward loop gains (indices match with the parameter paths)
 */
function getForwardPathsLoopgains(paths){
  var forwardLoopgains = [];

  paths.forEach(p => {
    var forwardEdges = extractPathEdges(p);
    var flg = calculateLoopGain(forwardEdges);
    forwardLoopgains.push(flg);
  });

  return forwardLoopgains;
}

/**
 * Helper function for getForwardPathsLoopgains()
 * Given a list of nodes that consist a path, extract relevant edges
 * that forms the same path
 * 
 * @param pathNodes - a list of node objects
 * @return a list of edge objects
 */
function extractPathEdges(pathNodes){
  var pathEdges = [];

  pathNodes.forEach((pn, i) => {
    if (i < pathNodes.length - 1){
      pe = pn.outgoingEdges.find(x => x.endNode === pathNodes[i+1].id);
      pathEdges.push(pe);
    }
  });

  return pathEdges;
}

/**
 * A = the original SFG
 * B = sub-SFG in A 
 * Returns A- B
 * @param originalNodes - the original, entire SFG represented as a list of nodes
 * @param nodesToSubtract - a sub-SFG that needs to be removed from originalNodes
 * @returns a sub-graph of originalNodes after nodesToSubtract has been removed
 */
function subtractNodes(originalNodes, nodesToSubtract){
  allnodes_copy = [];
  subgraph = [];
  
  // Quite inefficent... maybe optimize it somehow later
  originalNodes.forEach(n => {
    allnodes_copy.push(n.copy());
  });

  allnodes_copy.forEach(n => {
    // Check if the node should not be subtracted
    if (!nodesToSubtract.includes(n) && n.outgoingEdges.length > 0){
        nodesToSubtract.forEach((nts, i) => {
          edge_i = n.outgoingEdges.findIndex(e => e.endNode === nts.id);

          if (edge_i != -1){
            n.outgoingEdges.splice(edge_i, 1);
          }
        
      });
      subgraph.push(n);
    }
  });

  return subgraph;
}

/**
 * Returns the denominator for the transfer function using Mason's Rule formula
 *   Denominator = 1 - all loop gains + all 2 non-touching - all 3 non-touching ...
 *
 * @param allLoops - All simple cycles in a graph
 * @param nonTouching - List of nth order non-touching loops
 */
function calculateDenominator(allLoops, nonTouching) {
  let denom = new Expression(0).add(1);

  // Calculate sum of individual loop gains and subtract from exp
  allLoops.forEach((loop) => {
    denom = denom.subtract(calculateLoopGain(loop));
  });

  // Calculate sum of non-touching loop gains and subtract/add to exp depending on its index
  nonTouching.forEach((loops, index) => {
    let loopGain = new Expression();
    loops.forEach((loop) => {
      loopGain = loopGain.add(calculateLoopGain(loop));
    });
    if ((index % 2) === 0) {
      denom = denom.add(loopGain);
    } else {
      denom = denom.subtract(loopGain);
    }
  });
  return denom;
}

/**
 * Calculate the loop gain using the edge weights
 *
 * @param edges
 * @returns {Expression|*}
 */
function calculateLoopGain(edges) {
  let ex = new Expression(1);
  edges.forEach((e) => {
    ex = ex.multiply(`(${e.weight})`);
  });

  if (DEBUG) {
    console.log(`Loop Gain: ${ex.toString()}`);
    console.log(JSON.stringify(ex));
  }
  return ex;
}

/**
 * Returns a map of all sets of non-touching loops taken i at a time (i = [2, n]) given all of the loops in a graph
 *
 * @param allLoops
 * @returns {Map<i, [list of loo[s]]} where i indicates that the loops were taken i at a time (starts with 2)
 */
function findNonTouching(allLoops) {
  const numLoops = allLoops.length;
  let nonTouchingLoops = new Map();
  let prevSet, prevSetLength, ithNonTouch;
  let currLoop, currNodes, remainingLoop, remainingNodes, touching, loopGain, concatLoops;
  let existingGains = [];     // used to keep track of which loops were already counted

  // Initialize result map
  nonTouchingLoops.set(1, allLoops);

  let i, j; // start with non-touching loops taken 2 at a time
  for (i = 2; i <= numLoops; i++ ) {
    prevSet = nonTouchingLoops.get(i - 1);
    prevSetLength = prevSet.length;
    ithNonTouch = nonTouchingLoops.set(i, []).get(i);

    for (j = 0; j < prevSetLength; j++) {
      currLoop = prevSet[j];
      currNodes = prevSet[j].map((e) => e.endNode);

      // Compare against other loops in the graph
      for (innerIndex = 0; innerIndex < numLoops; innerIndex++ ) {
        remainingLoop = allLoops[innerIndex];
        concatLoops = remainingLoop.concat(currLoop);

        // check for duplicates
        loopGain = concatLoops.map((edge) => edge.id).sort().toString();
        if (existingGains.includes(loopGain))
          continue;

        remainingNodes = remainingLoop.map((e) => e.endNode);
        touching = remainingNodes.some((node) => currNodes.includes(node));
        if (!touching) {
          existingGains.push(loopGain);
          ithNonTouch.push(concatLoops);
        }
      }
    }

    // We didnt find any ith non-touching loops - won't find anymore so stop looking and cleanup result map
    if (!ithNonTouch.length) {
      nonTouchingLoops.delete(i);
      break;
    }
  }

  if (DEBUG) {
    console.log('===================================');
    console.log('PRINTING OUT ALL NON-TOUCHING LOOPS:');
    console.log('===================================');
    nonTouchingLoops.forEach((value, key) => {
      console.log(`${key} =>`);
      console.log(value);
    });
  }

  nonTouchingLoops.delete(1);
  return nonTouchingLoops;
}

/*
 * Export helper functions
 */
module.exports = {
  findAllLoops, findNonTouching, calculateDenominator, calculateNumerator
};
