# Revisiting Spacetrack Report #3 AIAA 2006-6753

Over a quarter century ago, the United States Department of Defense (DoD) released the equations and source code used to
predict satellite positions through SpaceTrack Report Number 3 (STR#3). Because the DoD's two-line element sets (TLEs)
were the only source of orbital data, widely available through NASA, this code became commonplace among users needing
accurate results. However, end users made code changes to correct the implementation of the equations and to handle rare
 cases encountered in operations. These changes migrated into numerous new versions and compiled programs outside the
 DoD. Changes made to the original STR#3 code have not been released in a comprehensive form to the public, so the code
 available to the public no longer matches the code used by DoD to produce the TLEs. Fortunately, independent efforts,
 technical papers, and source code enabled us to synthesize a non-proprietary version which we believe is up-to-date and
 accurate. This paper provides source code, test cases, results, and analysis of a version of SGP4 theory designed to be
 highly compatible with recent DoD versions.

## Are there any Licenses required to use the SGP4 code?

There is no license associated with the code and you may use it for any purpose—personal or commercial—as you wish. We
ask only that you include citations in your documentation and source code to show the source of the code and provide
links to the main page, to facilitate communications regarding any questions on the theory or source code.

[https://celestrak.org/publications/AIAA/2006-6753/faq.php](Link to Source)

## ootk-core Notes

Since the original authors do not have a license file, this file is to document the permission granted to use the code
to develop a TypeScript implementation.

The ootk-core TypeScript implementation is licensed under the MIT License. ootk-core is not affiliated with the original
authors.
