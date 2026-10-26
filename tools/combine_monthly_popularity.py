import pandas as pd
import sys

def combine_monthly_popularity(file1, file2, output_file, months=None):
    """
    Combine two trail monthly popularity TSV files by adding counts trail by trail, month by month.
    
    Args:
        file1: Path to first TSV file (base)
        file2: Path to second TSV file (to add)
        output_file: Path to output TSV file
        months: List of month column names. Defaults to Jan-Dec.
    """
    if months is None:
        months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    
    # Read files
    df1 = pd.read_csv(file1, sep='\t', encoding='utf-8')
    df2 = pd.read_csv(file2, sep='\t', encoding='utf-8')
    
    # Ensure numeric
    for m in months:
        df1[m] = df1[m].apply(pd.to_numeric, errors='coerce').fillna(0).astype(int)
        df2[m] = df2[m].apply(pd.to_numeric, errors='coerce').fillna(0).astype(int)
    
    # Add month columns from df2 into df1
    for m in months:
        if m in df2.columns:
            df1[m] = df1[m] + df2[m]
    
    # Save
    df1.to_csv(output_file, sep='\t', index=False, encoding='utf-8')
    
    # Print summary
    print('Combined {} trails.'.format(len(df1)))
    print()
    print('Monthly totals:')
    for m in months:
        print('  {}: {}'.format(m, df1[m].sum()))
    print('  Total: {}'.format(sum(df1[m].sum() for m in months)))
    
    return df1

if __name__ == '__main__':
    file1 = 'trail_monthly_popularity.tsv'
    file2 = 'ramblers_monthly_popularity.tsv'
    output = 'combined_monthly_popularity.tsv'
    
    if len(sys.argv) >= 4:
        file1 = sys.argv[1]
        file2 = sys.argv[2]
        output = sys.argv[3]
    
    combine_monthly_popularity(file1, file2, output)
