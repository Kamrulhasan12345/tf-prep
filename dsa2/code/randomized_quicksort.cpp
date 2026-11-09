// Randomized quicksort (CLRS 7.3): the pivot is a uniformly random element.
// Complexity: expected O(n log n) for every input; worst case O(n^2) with tiny probability.
// Build: g++ -std=c++17 -O2 -Wall -Wextra randomized_quicksort.cpp -o randomized_quicksort
// Run:   ./randomized_quicksort [seed] < in.txt
// Input: "n" then n integers. Output: the sorted integers on one line.
#include <iostream>
#include <random>
#include <utility>
#include <vector>
using namespace std;
mt19937 rng;

// BEGIN CORE
int partition(vector<int>& A, int p, int r) {          // PARTITION (Lomuto), pivot A[r]
    int x = A[r], i = p - 1;
    for (int j = p; j < r; j++) if (A[j] <= x) swap(A[++i], A[j]);
    swap(A[i + 1], A[r]);
    return i + 1;
}
int randomizedPartition(vector<int>& A, int p, int r) {
    int i = p + (int)(rng() % (unsigned)(r - p + 1));  // RANDOM(p, r)
    swap(A[r], A[i]);
    return partition(A, p, r);
}
void randomizedQuicksort(vector<int>& A, int p, int r) {
    if (p < r) {
        int q = randomizedPartition(A, p, r);
        randomizedQuicksort(A, p, q - 1);
        randomizedQuicksort(A, q + 1, r);
    }
}
// END CORE

int main(int argc, char** argv) {
    rng.seed(argc > 1 ? (unsigned)stoul(argv[1]) : random_device{}());
    int n; cin >> n; vector<int> A(n);
    for (int& x : A) cin >> x;
    randomizedQuicksort(A, 0, n - 1);
    for (int i = 0; i < n; i++) cout << (i ? " " : "") << A[i];
    cout << "\n";
}
